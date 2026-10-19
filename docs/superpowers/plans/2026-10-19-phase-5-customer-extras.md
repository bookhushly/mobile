# Phase 5 Customer Extras Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Customers claim their guest bookings, cancel, request event refunds, transfer event tickets and post reviews. The app also adopts the web's new `/bookings/mine`, per-booking codes and read-all routes.

**Architecture:**

- Pure action rules and outcome mapping live in `features/customer/domain`.
- Route clients go through the shared API client, with 404 fallbacks for routes production may not have yet.
- Hook state machines and a Manage booking section feed one sheet per action.
- Claim UI sits on the Bookings tab.

**Tech Stack:** Expo SDK 57, React 19.2 + Compiler, TanStack Query 5, zod v4, Jest + RNTL v14.

**Spec:** `docs/superpowers/specs/2026-10-19-phase-5-customer-extras-design.md` (E1–E10). Contract: `docs/BACKEND_STATUS.md` §7, §7a, §9 "Customer 5". The web contract doc is `../web/docs/mobile/CUSTOMER_BOOKINGS_API.md` (read-only; get it with `git -C ../web show origin/main:docs/mobile/CUSTOMER_BOOKINGS_API.md`).

## Global Constraints

- **Code rules** (hooks enforce):
  - TS strict + `noUncheckedIndexedAccess`.
  - No `any`, `@ts-ignore`, `console.log`, raw hex or `fontWeight`.
  - Tokens only.
  - `features/customer` imports no other feature.
  - Domain stays pure.
- **POSTs:** never `idempotent`, never auto re-posted.
- **Uncertain outcomes:** cancel and transfer re-read the booking; nothing else is inferred.
- **Wording:** every 429 and transient error is neutral, never a refusal. Refusals are in words; raw server text is never shown.
- **Fallback:** when `/api/bookings/mine`, `/api/bookings/event/{id}/codes` or `/api/notifications/read-all` answer 404, the 4a paths keep working.
- **Copy:** sentence case, 12-hour times, curly apostrophes. "Check your connection" for network errors, "try again" otherwise.
- **Tests:** RNTL v14 async. Test QueryClients `{ retry: false, gcTime: Infinity }`, cleared after each test. Fake timers where needed. Output pristine.
- **Before each commit:**
  - `npx tsc --noEmit`, `npx expo lint --no-cache`, touched tests and prettier pass.
  - Specific paths only. Never `CLAUDE.md` or `.claude/skills/update-docs/`.
  - No co-author or "Generated with" trailers.
  - Commit as soon as each step passes, so a network drop can't lose work.

## Review Focus

1. **Lost response on cancel:** a timeout followed by a re-read that shows `cancelled` reads "Cancelled", never "Couldn't cancel" (Task 3 + 5).
2. **Lost response on transfer:** the booking moved, so the re-read gets not-found; it reads "Tickets sent" (Task 3 + 5).
3. **Gate-staff or receptionist account:** the claim card never appears (`not_customer`) (Task 4).
4. **Older production without the new routes:** `/mine`, `/codes` and read-all answering 404 still work through the RLS and per-ticket paths (Task 2 + 3).
5. **Lagos midnight:** the cancel and review offers follow the Lagos date. The server may still refuse at the edge, and that reads in words (Task 1).

---

### Task 1: Action rules and outcome mapping (pure)

**Files:** create `features/customer/domain/bookingActions.ts`, `actionOutcome.ts` + tests.

**Produces:**

```ts
export type BookingAction = 'transfer' | 'refund' | 'review' | 'cancel';
export function bookingActions(row: EventBookingRow | HotelBookingRow | ApartmentBookingRow, kind: BookingKind, today: IsoDate, nowMs: number): BookingAction[]; // ordered transfer, refund, review, cancel
export type MoneyLine = 'nothingCharged' | 'hotelFullRefund' | 'refundIfReversible';
export function cancelMoneyLine(row, kind): MoneyLine;
export type ActionOutcome<T> = { kind:'done'; value:T } | { kind:'refused'; reason: Refusal } | { kind:'uncertain' } | { kind:'rateLimited'; retryAfterSec:number|null } | { kind:'signedOut' };
export type Refusal = 'notCancellable'|'eventPassed'|'checkInPassed'|'bookingChanged'|'forbidden'|'notFound'|'alreadyRequested'|'notRefundable'|'notTransferable'|'alreadyReviewed'|'notEligible'|'invalidCode'|'notCustomer'|'emailUnverified'|'invalid';
export function cancelOutcome(r), refundOutcome(r), transferOutcome(r), reviewOutcome(r), claimOutcome(r): ActionOutcome<…>;
```

**Rules:**

| Action     | Condition                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------- |
| `cancel`   | per spec E5                                                                               |
| `refund`   | events only: paid (`completed`), confirmed, start not passed                              |
| `transfer` | same condition as `refund`                                                                |
| `review`   | per spec E8 (hotel `completed`, apartment `paid`, event `completed`, with the date rules) |

Outcome mapping by code:

| Code                                                                                                     | Maps to                                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `not_cancellable`                                                                                        | `notCancellable`                                       |
| `event_passed`                                                                                           | `eventPassed`                                          |
| `check_in_passed`                                                                                        | `checkInPassed`                                        |
| `booking_changed`                                                                                        | `bookingChanged`                                       |
| `forbidden`                                                                                              | `forbidden`                                            |
| `not_found`                                                                                              | `notFound`                                             |
| `already_reviewed`                                                                                       | `alreadyReviewed`, which **counts as done** for review |
| `no_completed_booking`                                                                                   | `notEligible`                                          |
| `invalid_code` (400/403)                                                                                 | `invalidCode`                                          |
| `not_customer`                                                                                           | `notCustomer`                                          |
| `email_unverified`                                                                                       | `emailUnverified`                                      |
| `unavailable`, `claim_failed`, `send_failed`, `cancel_failed`, `fetch_failed`, any 5xx, network, timeout | `uncertain` for POSTs; transient otherwise             |
| 429                                                                                                      | `rateLimited`                                          |
| 401 after refresh                                                                                        | `signedOut`                                            |

Routes with no codes map by status:

- **Refund:** 409 → `alreadyRequested`; 400 → `notRefundable`; 403/404 → `notFound`.
- **Transfer:** 400 → `notTransferable`; 403/404 → `notFound`.

- [ ] Write the tests per the tables (RED → GREEN), including the Lagos-midnight edges. Commit `feat(customer): booking action rules and outcome mapping`.

### Task 2: Route clients and fallbacks

**Files:** in `features/customer/api/`, create `myBookingsApi.ts`, `eventCodesApi.ts`, `claimApi.ts`, `bookingActionsApi.ts`, and extend `reviewsApi.ts` with `postReview`; in `customerDb.ts` or a new `notificationsApi.ts`, add `readAll`; tests for each.

**Behaviour:**

- **`fetchMyBookings(c)`**
  - Calls `GET /api/bookings/mine`.
  - zod-parses each list into the **existing** row types: read the contract doc and map `room_number` and `room_type` into the hotel row (add optional fields to the schemas). Fields our schemas need but `/mine` lacks become nullable.
  - On 404 it returns `{ fallback: true }`.
- **`fetchEventCodes(c, bookingId)`** calls `GET /api/bookings/event/{id}/codes` and returns `{ format, expiresAt, stepSeconds, tickets:[{id, type, index, checkedInAt, token|null}] }`. 404 → `{ fallback: true }`.
- **`readAllNotifications(c)`** calls `POST /api/notifications/read-all` → `{updated}`. 404 → `{ fallback: true }`.
- **Claim:**
  - `claimCounts(c)` → `GET /api/bookings/claim`.
  - `sendClaimCode(c)` → `POST …/claim/code`.
  - `claim(c, code)` → `POST …/claim {code}`.
- **Booking actions:**
  - `cancelBooking(c, kind, id)` → `POST /api/bookings/{event|hotel|apartment}/{id}/cancel`, no body.
  - `requestRefund(c, bookingId, reason)` → `POST /api/refunds/request {booking_id, reason}`.
  - `transferTickets(c, bookingId, newEmail)` → `POST /api/bookings/event/{id}/transfer {new_email}`.
  - `postReview(c, listingId, type, rating, comment)` → `POST /api/reviews/{listingId}`.
- **Every route:** Bearer (the default client), never `idempotent`, ids encoded, explicit zod bodies.

- [ ] Write the tests: paths, bodies, schemas, 404 fallbacks, no idempotent flag. Commit `feat(customer): routes for my bookings, codes, read-all, claim, cancel, refund, transfer and reviews`.

### Task 3: Hooks

**Files:** in `features/customer/hooks/`:

- `useMyBookings`: try `/mine`, fall back to the RLS reads on `fallback`, with the wallet unchanged. Find the listing ids for reviews in the rows (`listing_id`, `hotel_id`, `apartment_id`) and add them to the schemas if missing.
- `useLiveCodes(bookingId, active)`: one poll per booking at `expires_at − 2 s` on the server clock. Fall back to the 4a per-ticket `useLiveCode` on 404. The TicketsScreen switches to it.
- Notifications: `markAllRead` uses read-all, with the RLS fallback.
- `useClaim`: counts with 5 min stale on focus; `send`, `verify`, and `state: idle|sending|codeSent|verifying|done{total}|error`.
- `useCancelBooking`, `useRefundRequest`, `useTransferTickets`: single-flight. `uncertain` re-reads the booking (cancel: `cancelled` → done; transfer: not-found or missing from `/mine` → done).
- `usePostReview`, `useReviewedSet` (plainKv `bh.reviewed.<uid>`), `useRefundRequested` (plainKv `bh.refund-req.<uid>`). Both keys are wiped on sign-out via `registerAlwaysWipe`, and no write happens unless the same user is still signed in.
- Tests for each.

- [ ] Commit in steps. The last commit is `feat(customer): hooks for claiming, cancelling, refunds, transfers and reviews`.

### Task 4: Claim guest bookings UI

**Files:** `features/customer/ui/ClaimCard.tsx`, `ClaimSheet.tsx`; wire both into `BookingsScreen` (and its empty state); tests.

**Content:**

- **ClaimCard (spec §3):** info tone; dismissible for the session; hidden when `total` is 0, `not_customer` or loading.
- **ClaimSheet:**
  - Step 1: explanation, masked email (`shared/lib/maskEmail`), **Send code**.
  - Step 2: `CodeField` (from the kit), with a resend timer of 60 s or `retry_after`.
  - Step 3: result "Added N bookings" and **Done**.
  - Errors per E4.
- **One Modal only.**

- [ ] RNTL tests: card visibility (counts, zero, `not_customer`, `email_unverified` copy), send, wrong code clears, rate limit countdown, success refreshes bookings. Commit `feat(customer): add guest bookings to your account`.

### Task 5: Manage booking and action sheets

**Files:**

- In `features/customer/ui/`: `ManageBooking.tsx`, `CancelSheet.tsx`, `RefundSheet.tsx`, `TransferSheet.tsx`, `ReviewSheet.tsx`, `StarRating.tsx`.
- Wire them into `BookingScreen` (and the 4a footer note "To change or cancel, use bookhushly.com" is removed).
- Tests for each.

**Content:** spec E5–E9 and §3.

- **Layout:**
  - The Manage booking rows list only the available actions, with Cancel last in the danger tone.
  - Every sheet is one Modal and closes before any navigation.
  - The destructive buttons use the danger variant.
- **Review sheet:**
  - Stars form an accessible radio group, each at least 44 pt.
  - The rating word sits under the stars.
  - The comment is 10–1000 characters, with a counter.
- **Transfer sheet:** two steps (email, then review). The user's own email is refused (from the profile or session email).
- **After success:**
  - Invalidate the bookings and the wallet.
  - A transfer also removes the booking's tickets from the device: re-save the wallet.

- [ ] RNTL tests per the spec §7 list (each money line; refusal words; uncertain → re-read → done; refund duplicate; transfer own-email and the two steps; review post / already reviewed / not eligible; only allowed actions shown). Commit `feat(customer): cancel, refund, transfer and review from booking details`.

### Task 6: Docs

- `docs/MOBILE_APP_REQUIREMENTS.md` FR-2.11/2.12/2.14/2.22: Phase 5 notes.
- `docs/device-tests/2026-10-19-phone-checks-phase-5-extras.md`:
  - **Claim:** book as a guest on the web with the QA email while signed out, then claim in the app.
  - **Cancel:** an unpaid booking, a paid hotel, and a paid event.
  - **Refund request** on an event.
  - **Transfer:** to a second QA account, which sees the tickets.
  - **Review:** after a past event.
  - **Lost-connection cases:** airplane mode right after Cancel and after Transfer.
  - **Clean-up:** cancel or refund every test booking through these flows.

- [ ] Commit `docs(phase-5): requirement notes and the extras phone checklist`.
