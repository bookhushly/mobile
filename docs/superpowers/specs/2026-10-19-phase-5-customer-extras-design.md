# Phase 5 — Customer extras: claim, cancel, refund, transfer, review (design)

**Status:** decided 2026-10-19 under the owner's standing instruction to make every call ("good you may proceed to next phase"). Rulings in §2 give the reason for each call and what it costs if wrong.

**Branch:** `feat/phase-5-customer-extras`. Builds on Phase 4a (bookings, tickets, notifications) and 4b (discover).

**Requirements:** FR-2.11 (cancel, refund request), FR-2.12 (transfer), FR-2.14 (reviews), FR-2.22 (claim guest bookings), plus adopting the web's new customer routes (BACKEND-REQ-7 partial).

**Backend:** re-verified against web `origin/main` @ `ab7c4cd1`. See `docs/BACKEND_STATUS.md` §7, §7a and §9 "Customer 5".

**References:** `docs/design-references/2026-10-19-phase-5-customer-extras-mobbin.md`.

**Still blocked (4c):** in-app booking, payment and push.

**Left out of this phase:**

- Waitlist: its GET/DELETE take a guest's email without sign-in (§9 Customer 5(e)).
- Follow organiser: a toggle, not idempotent.
- Ticket resend.
- Apartment change requests, disputes and messages.

## 1. Goal and success

A signed-in customer can:

- add the bookings they made as a guest to their account;
- cancel a booking the server allows them to cancel;
- ask for a refund on an event booking;
- send their event tickets to someone else by email;
- review a stay or event they've completed.

Every action shows what will happen to the money or the tickets before it runs. Every result comes from the server's answer, never from the app's own guess.

The phase is done when, on the Moto G06 against production, using the QA customer and real web-made bookings:

- a guest booking is claimed and then appears in Bookings;
- one booking is cancelled, with its refund outcome shown;
- one ticket is transferred to a second test account;
- one review is posted after a past event;
- no transient failure ever reads as a refusal;
- no test data is left behind, because each item is cancelled or refunded through the same flows;
- `tsc`, lint and jest pass, and the Phase 5 phone checklist passes.

## 2. Decisions (rulings)

| #   | Ruling                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Why                                                                                                  | Cost if wrong                                                                     |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| E1  | **Bookings keep the 4a RLS reads as the primary source** (amended 2026-10-19 after review): `GET /api/bookings/mine` omits `event_end_date`, hotel/apartment `address` and `check_in_time`/`check_out_time`, so adopting it would show multi-day events as past from day two and drop check-in times. The `/mine` client stays (tested) for when web adds those fields (§9 Customer 5 (i)). Room numbers and hidden-listing titles remain the 4a gap until then.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | No regression on screens; web asked to complete `/mine`.                                             | Room numbers still absent.                                                        |
| E2  | **Live codes come from `GET /api/bookings/event/{id}/codes`:** one poll per booking while the ticket viewer is open, refreshed at `expires_at − 2 s`. A null token on a ticket means it is already used (show "Admitted"). If the route answers 404, the per-ticket route is used instead.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Stays within the `ticket` tier for large groups (§9 4a(f) fixed on web).                             | —                                                                                 |
| E3  | **Notifications:** "Mark all as read" uses `POST /api/notifications/read-all` (returns `{updated}`), falling back to the RLS write on 404. Targets prefer `data.booking_type` + `data.booking_id`, then the 4a camelCase fallback.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Fixes the 4a limitation where "Mark all as read" couldn't tell a stale session from an empty result. | —                                                                                 |
| E4  | **Claim guest bookings:** <ul><li>On Bookings focus (5 min stale), `GET /api/bookings/claim` checks for claimable bookings. If `total > 0`, a card shows the counts.</li><li>The flow: a sheet with the masked email and **Send code** (`POST …/claim/code`), then the UI-B `CodeField` with a 60 s resend timer (or `retry_after`), then `POST …/claim {code}`. The result reads "Added N bookings" and refreshes Bookings and the wallet.</li><li>Errors:<ul><li>`not_customer`: the card never shows. Gate and desk accounts get this from GET too.</li><li>`email_unverified`: the card says to confirm the email first.</li><li>`invalid_code`: "That code is wrong or has expired".</li><li>Rate limits: a neutral countdown.</li><li>`claim_failed`, `send_failed`, `unavailable`: neutral "try again".</li></ul></li><li>Claims are idempotent in effect: a second claim simply adds 0.</li></ul>                                                                                                                                                                                                                                                                              | FR-2.22 (DECISION-6); contract §7a.                                                                  | —                                                                                 |
| E5  | **Cancel:** a **Cancel booking** action appears on Booking details only when the app can tell it is plausibly allowed: <ul><li>Event: status pending or confirmed and the start not passed.</li><li>Hotel: not cancelled, checked in, checked out or no-show, and check-in after today (Lagos).</li><li>Apartment: not cancelled, checked in or checked out.</li></ul> The confirm sheet: <ul><li>Shows what is cancelled and the honest money line: unpaid "Nothing is charged"; paid hotel "A full refund is sent to your payment method"; paid event or apartment "We'll refund you if the payment can be reversed".</li><li>Says "This can't be undone", with a destructive **Cancel booking** and **Keep booking**.</li><li>The result shows the server's `refunded` / `refund_initiated` / `refund_message` in words.</li></ul> The server decides. Its refusal codes map to words: `not_cancellable`, `event_passed`, `check_in_passed`, `booking_changed` ("This booking changed — pull to refresh"), `forbidden`. **An uncertain answer re-reads the booking:** if it's now cancelled, the cancel succeeded. Otherwise "Couldn't confirm. Check again". No automatic re-post. | Contract §C. Desk reconcile pattern.                                                                 | The server can still refuse a plausible cancel; the refusal is shown in words.    |
| E6  | **Refund request (events only):** offered on paid, confirmed events that haven't passed, as **Ask for a refund** next to Cancel. <ul><li>The sheet takes a reason (required, at most 500, with a counter) and **Send request**. 201 → "Request sent. The organiser reviews it and we'll notify you".</li><li>The route has no codes, so statuses map to words: 409 → "You've already asked for a refund"; 400 → "This booking can't be refunded now"; 403/404 → "This booking isn't on your account"; transient → neutral.</li><li>No refund-status screen (no route); a sent request is remembered locally per booking so the button reads "Refund requested".</li></ul>                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Contract §C; §9 Customer 5(b)(c).                                                                    | Local memory is lost on reinstall; a re-request gets 409, which reads correctly.  |
| E7  | **Transfer tickets (events):** offered on paid, confirmed events that haven't passed. <ul><li>Two steps in one sheet: the email (validated on blur; your own email is refused), then a review (event, date, tickets, the recipient's **full** email so a typo can be caught — amended 2026-10-19; only the result banner masks it, "You'll lose these tickets. This can't be undone") and **Transfer tickets**.</li><li>Success: "Tickets sent". The booking leaves the list, the wallet is refreshed, and the tickets are wiped from the device.</li><li>Errors by status (no codes): 400 → "These tickets can't be transferred" (or the specific own-email check client-side); 403/404 → not on your account.</li><li>**An uncertain answer re-reads:** if the booking is no longer readable (it moved), the transfer succeeded.</li></ul>                                                                                                                                                                                                                                                                                                                                           | FR-2.12; Mobbin Posh review step.                                                                    | —                                                                                 |
| E8  | **Reviews:** **Write a review** shows on past bookings that look eligible: <ul><li>Hotel: paid, and checked out or check-out ≤ today.</li><li>Apartment: paid (`paid`), same rule.</li><li>Event: paid, and the event date ≤ today.</li></ul> `POST /api/reviews/{listingId}` with `listing_type` hotel, apartment or event, `rating` 1–5 and `comment` (required, 10–1000 characters client-side). 200 → "Thanks — your review is live" and the button becomes "Reviewed". 409 `already_reviewed` → "Reviewed" (no error). 403 `no_completed_booking` → "You can review after your stay or event". The reviewed set is remembered per user on the device (plainKv, wiped on sign-out) so the button stays "Reviewed".                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Contract §C (eligibility rule; UTC "today" means a Lagos-midnight edge — the server decides).        | Remembered state is lost on reinstall; a re-post answers 409 and reads correctly. |
| E9  | **One place to act:** Booking details gains a **Manage booking** section listing only the available actions (Transfer tickets, Ask for a refund, Write a review, Cancel booking; Cancel last, in the danger tone). Each opens one sheet: one Modal at a time, closing before navigating.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Mobbin Navan, GetYourGuide "Need to make a change?".                                                 | —                                                                                 |
| E10 | **Rate tiers:** cancel, refund and transfer are on `public` (60/min per IP); reviews, claim and `/mine` on `user` (30/min per IP); claim code sends on `auth` (5/min per IP + 3 per 15 min per account). Every 429 shows a neutral countdown and never a refusal. Nothing auto-retries a POST.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Contract §C.                                                                                         | —                                                                                 |

## 3. Screens and components

| Piece                                | Content                                                                                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Claim card** (Bookings, top)       | "Bookings made as a guest" · "3 bookings made with a•••@gmail.com can be added to your account" · **Add them**. Info tone, dismissible for the session. |
| **Claim sheet**                      | Step 1: explanation + masked email + **Send code**. Step 2: `CodeField` + resend timer + **Add bookings**. Step 3: result.                              |
| **Manage booking** (Booking details) | Rows for the available actions (E9).                                                                                                                    |
| **Cancel sheet**                     | Per E5.                                                                                                                                                 |
| **Refund sheet**                     | Per E6.                                                                                                                                                 |
| **Transfer sheet**                   | Per E7 (two steps).                                                                                                                                     |
| **Review sheet**                     | Booking title + dates, `StarRating` (5 × 44 pt, word under it), comment with a counter, **Post review**.                                                |

## 4. Architecture

| Unit                                                          | Where                       | Job                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------- | --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bookingActions.ts` (domain)                                  | `features/customer/domain/` | Pure: per booking (row + today Lagos) → which actions to offer (`cancel`, `refund`, `transfer`, `review`), and the cancel sheet's money line.                                                                                                                    |
| `actionOutcome.ts` (domain)                                   | `features/customer/domain/` | Pure: map results from the cancel, refund, transfer, review and claim routes to `done \| refused{reason} \| uncertain \| rateLimited \| signedOut` (codes where present, otherwise status).                                                                      |
| `claimApi.ts`, `bookingActionsApi.ts`, `reviewsApi.ts` (POST) | `features/customer/api/`    | Routes through the shared client, never `idempotent`; zod bodies.                                                                                                                                                                                                |
| `myBookingsApi.ts`                                            | `features/customer/api/`    | `GET /api/bookings/mine` → zod → the existing row shapes (so mapping and the wallet are unchanged); 404 → `{ fallback: true }`.                                                                                                                                  |
| `eventCodesApi.ts`                                            | `features/customer/api/`    | `GET /api/bookings/event/{id}/codes`; 404 → fallback to per-ticket.                                                                                                                                                                                              |
| hooks                                                         | `features/customer/hooks/`  | `useClaim` (counts + send + verify state machine), `useCancelBooking`, `useRefundRequest`, `useTransferTickets`, `usePostReview`, `useReviewedSet`, `useRefundRequested`; `useMyBookings` (source switch); `useLiveCodes` (per booking); notifications read-all. |
| UI                                                            | `features/customer/ui`      | `ClaimCard`, `ClaimSheet`, `ManageBooking`, `CancelSheet`, `RefundSheet`, `TransferSheet`, `ReviewSheet`, `StarRating`.                                                                                                                                          |

`features/customer` imports no other feature.

## 5. Error handling

- Refusals use the danger or warning tone, in words. Transient failures (network, timeout, 5xx, 429) are neutral, with a countdown or Try again.
- **Uncertain outcomes on irreversible actions** (cancel, transfer) re-read the booking. They never re-post automatically.
- **Signed out (401 after refresh):** the existing session-expired path.

## 6. Accessibility and motion

- Stars are a radio group: "Rating, 4 of 5, Very good". Each star is at least 44 pt.
- Counters are read politely.
- Destructive buttons are the danger variant, with the words "Cancel booking" and "Transfer tickets".
- Sheets scroll at large text.
- Reduce Motion: no star bounce.

## 7. Testing

- **TDD for the pure units:**
  - `bookingActions`: every kind × status × date edge, including Lagos midnight.
  - `actionOutcome`: every code and status from §2 E4–E8, including 429 with and without `retry_after`.
  - The masked email.
- **API tests:**
  - Request paths and bodies.
  - Requests never sent with `idempotent`.
  - The 404 fallbacks for `/mine`, `/codes` and read-all.
- **RNTL:**
  - The claim flow: counts, send, wrong code, rate limit, success refreshes.
  - Cancel: each money line, refusal, and uncertain → re-read → done.
  - The refund duplicate.
  - Transfer: two steps, own email refused, uncertain → moved.
  - Review: post, already reviewed, not eligible.
  - Manage booking shows only the allowed actions.
- **No production calls from tests.**
- **Device run:** make all bookings through the real web flow (two QA accounts). Cancel or refund them afterwards through these same flows, so nothing is left behind.

## 8. Docs

- **`docs/BACKEND_STATUS.md`:** already updated in this branch (§7, §7a, §9 Customer 5).
- **Requirements:** FR-2.11/12/14/22 get notes.
- **Phone checklist:** gains a Phase 5 part.

## 9. Out of scope

- The waitlist and following organisers (security and idempotency gaps, §9 Customer 5(d)(e)).
- Ticket resend.
- Apartment change requests, disputes and messages.
- A refund status screen (no route exists).
- Reviewing without a booking.
- In-app booking, payment and push (4c).
