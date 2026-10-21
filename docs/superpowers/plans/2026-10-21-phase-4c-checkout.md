# Phase 4c In-app Checkout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a signed-in customer books a hotel room, apartment or event and pays with Paystack inside the app, without double charges, lost payments or trusting the redirect.

**Architecture:** pure domain modules (selection, request building, outcome mapping, payment state machine, status mapping) under `src/features/customer/domain/checkout/`, with tests first. A small plainKv-backed `checkoutStore` survives a kill. One `checkoutApi` module talks to the routes through the shared API client. Hooks drive the state machine from `expo-web-browser` and `AppState`. Two new routes: Select (`/checkout/[kind]/[listingId]`) and Pay (`/pay/[kind]/[bookingId]`).

**Tech Stack:** Expo SDK 57, expo-router 57, React 19.2 with the React Compiler, TanStack Query 5, supabase-js (RLS reads), zod v4, Jest + RNTL v14 (async), `expo-web-browser` ~57.0.3 (already installed).

**Spec:** `docs/superpowers/specs/2026-10-21-phase-4c-checkout-design.md` (rulings P1–P29). The contracts are in `docs/BACKEND_STATUS.md` §7b and §5.

## Global Constraints

- **Kill switches:** `src/shared/config/features.ts` gains `checkoutStays: false`, `checkoutEvents: true` and `checkoutPayments: true`, exported as `CHECKOUT_STAYS_ENABLED`, `CHECKOUT_EVENTS_ENABLED` and `CHECKOUT_PAYMENTS_ENABLED` (P2).
- **API base:** the apex `https://bookhushly.com`. Every call goes through the shared API client (`src/shared/api/client.ts`); no raw `fetch`.
- **Payment requests:** never send `amount` or `metadata` to `/api/payment/initialize` (P4). Never send money fields to create.
- **Retries:**
  - Initialise is never `idempotent`, so the client never retries it.
  - Event create is never `idempotent`.
  - Hotel and apartment create are `idempotent: true` **only** with an `Idempotency-Key` header (P12).
- **Quantities:** event quantities are positive integers only; omit zero lines. Per package 0–20, sum 1–20 (P18).
- **Paid means:**
  - a payment: `payments.status === 'completed'` and `fulfilled === true`;
  - a booking: hotel/event `payment_status === 'completed'`, apartment `'paid'` (P15).
- **Error words:** a transient answer (network, timeout, 429, 5xx, 404 from status/verify) never reads as a refusal (P14).
- **Polling:** after the browser closes, verify once, then poll status at 2, 3, 5, 8, 13 s and then every 15 s, for at most 180 s in total (P6).
- **Hold window:** stays are payable until `created_at + 25 min`, measured on the server clock (`useServerNow`) (P8, P29).
- **Pending payments without a stored URL:** a new initialise is allowed when the pending reference is ≥ 15 min old; a stored URL older than 24 h is never reopened (P26).
- **Browser options:** `WebBrowser.openBrowserAsync(url, { createTask: false, showInRecents: false })` (P6).
- **Code rules:**
  - No `any`, `@ts-ignore`, `console.log`, raw hex, `fontWeight`, animated layout props, or cross-feature or domain→React imports (hooks enforce these).
  - Tokens from `@/shared/theme`; UI from `@/shared/ui`.
  - Copy is sentence case, min text 12 px, touch targets ≥ 44 pt.
  - Outcomes use colour + icon + text + haptic.
  - Money is formatted with the existing `PriceTag`/naira formatter.
  - Lagos dates use `@/shared/lib/lagosDay`; times are 12-hour.
- **Tests:** RNTL v14 is async (`await render`, `await fireEvent…`); Jest can't do dynamic `import()`; zod v4 (`z.email()`).
- **Done gate:** `npx tsc --noEmit`, `npx expo lint --no-cache` and `npx jest` must pass before every commit that touches `src/`.
- **Commits:** stage specific paths only; no co-author trailers.

## Review Focus

1. **Double Pay tap, or Pay while a pending reference exists:** exactly one initialise; the second tap does nothing; an existing pending reference is reused (Task 8 test `pay twice sends one initialise`).
2. **App killed on the Paystack page and reopened later:** the stored entry is resumed (verify then status) without a new initialise, and the booking shows "Checking your payment…" (Task 8 test `resume after kill verifies and never initialises`).
3. **Android returns from the Custom Tab only via AppState:** Checking starts on `background → active`, not on `opened` (Task 8 test `android starts checking on AppState active`).
4. **A hold that crosses 25 min while on Review:** Pay turns into Start again, with no initialise after the window (Task 5 test `hold window closes at 25 minutes`, Task 11 screen test).
5. **Event lost answer:** no automatic re-post. Check again adopts the pending booking found by the RLS read, else re-enables Continue (Task 8 test `event create lost answer adopts the pending row`).

---

### Task 1: API client headers, feature switches

**Files:**

- Modify: `src/shared/api/client.ts` (`RequestOptions`, header assembly near line 78)
- Modify: `src/shared/config/features.ts`
- Test: `src/shared/api/__tests__/client.test.ts` (extend the existing file)

**Interfaces:**

- Produces:
  - `RequestOptions<T>.headers?: Record<string, string>`, merged into the request; it never overrides `Authorization`, `Content-Type`, `X-App-Version` or `X-Platform`.
  - `CHECKOUT_STAYS_ENABLED: boolean` (false), `CHECKOUT_EVENTS_ENABLED: boolean` (true), `CHECKOUT_PAYMENTS_ENABLED: boolean` (true).

- [ ] **Step 1:** Write tests:
  - `sends extra headers`: `headers: { 'Idempotency-Key': 'k1' }` appears on the fetch init.
  - `extra headers cannot replace Authorization`: passing `Authorization: 'x'` still sends the Bearer token.
  - `retries keep the same Idempotency-Key`: an idempotent POST retried after a 503 sends the same key twice.
- [ ] **Step 2:** `npx jest src/shared/api` → FAIL.
- [ ] **Step 3:** Implement. Spread `opts.headers` first, then set the reserved headers.
- [ ] **Step 4:** Add the three switches to `features.ts`, each with a comment citing P2. `checkoutStays` is off until web #221 is deployed.
- [ ] **Step 5:** `npx jest src/shared/api && npx tsc --noEmit` → PASS. Commit: `feat(api): per-request headers; checkout kill switches`.

### Task 2: Checkout schemas

**Files:**

- Create: `src/features/customer/schemas/checkout.ts`
- Test: `src/features/customer/schemas/__tests__/checkout.test.ts`

**Interfaces:**

- Produces zod schemas and their inferred types:
  - **`stayCreated`:** `{ booking: { id, type: 'hotel'|'apartment', status, payment_status, total: number, currency, nights, check_in_date, check_out_date, guest_name, guest_email, guest_phone, pricing: Record<string, number|null>, created_at, hotel?: {id,name}, room_type?: {id,name}, apartment?: {id,name} }, next: { payment: { type, id, amount: number, endpoint } }, replayed?: boolean }`. Unknown keys pass through; numbers accept numeric strings.
  - **`eventCreated`:** `{ booking: { id, status, payment_status, total_amount: number, created_at, listing_id, ticket_details } }`.
  - **`roomAvailability`:** `{ totalRooms, bookedCount, freeRooms, available: boolean }`.
  - **`promoResult`:** discriminated on `valid`: `{ valid: true, code_id, code, discount_amount, discounted_total }` | `{ valid: false, error: string }`.
  - **`serviceCharge`:** `{ charge: null | { charge_type: string, charge_value: number, enabled: boolean, label: string|null } }`.
  - **`initialized`:** `{ success: true, payment: { id, reference, amount, base_amount, service_charge_amount, service_charge_label: string|null, currency, payment_url: z.url() } }`.
  - **`checkStatus`:** union of `{ hasPaid: true, payment: { reference, status, created_at } }`, `{ hasPaid: false, hasPending: true, payment: { reference, status, created_at } }` and `{ hasPaid: false, hasPending: false }`.
  - **`verified`:** `{ verified: boolean, status: string, payment?: { reference, status } }`.
  - **`paymentState`:** `{ payment: { reference, status: string, fulfilled: boolean, request_type }, request: { id, status: string|null, payment_status: string|null } | null }`.
  - **`customQuestion`:** `{ id: string, label: string, type: 'text'|'textarea'|'select', options: string[], required: boolean }`, plus `parseCustomQuestions(raw: unknown): CustomQuestion[]`. It accepts an array or a JSON string and skips invalid items. `label` comes from `question ?? label ?? text`. First read `../web/components/common/EventTicketPurchase.jsx` (read-only) to confirm the key names and record them in a comment.
- [ ] **Step 1:** Write tests, one per schema:
  - a valid body parses;
  - a missing required field fails;
  - `checkStatus` picks each branch;
  - `parseCustomQuestions('[{"id":"q1","question":"Size?","type":"select","options":["S","M"],"required":true}]')` returns one question with `label: 'Size?'`;
  - `parseCustomQuestions('not json')` returns `[]`;
  - an item with an unknown `type` is skipped.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat(customer): checkout response schemas`.

### Task 3: Selection domain

**Files:**

- Create: `src/features/customer/domain/checkout/selection.ts`
- Test: `src/features/customer/domain/checkout/__tests__/selection.test.ts`

**Interfaces:**

- Consumes: `RoomRate`, `TicketPackage` (from `schemas/listings.ts`), `CustomQuestion` (Task 2), `lagosDay` helpers.
- Produces:
  - **Types:**
    - `type Guest = { name: string; email: string; phone: string }`
    - `type StaySelection = { checkIn: string|null; checkOut: string|null; adults: number; children: number; rateId: string|null; breakfast: Record<string, number>; airport: { on: boolean; type: 'pickup'|'dropoff'|'both'; code: string|null }; promo: { codeId: string; discount: number }|null; guest: Guest; specialRequests: string }` (apartments use `adults` as `number_of_guests` and ignore `rateId`/`breakfast`/`promo`)
    - `type EventSelection = { qty: Record<string, number>; answers: Record<string, string>; promo: {codeId: string; discount: number}|null; guest: Guest }`
  - **Rates and nights:**
    - `defaultRate(rates: RoomRate[], roomTypeId: string, requested: string|null): RoomRate|null`. Order: the requested rate if it belongs to the room type, then `is_default`, then the cheapest; null when there are no rates, in which case base price is used (P25).
    - `nights(checkIn: string, checkOut: string): number`
  - **Validation:**
    - `stayProblems(s: StaySelection, rules: { today: string; minNights: number; maxGuests: number|null; kind: 'hotel'|'apartment' }): StayProblem[]`, where `type StayProblem = 'dates' | 'minNights' | 'maxGuests' | 'guestName' | 'guestEmail' | 'guestPhone'`. Dates: check-in ≥ today (Lagos), check-out > check-in, ≤ 90 nights. Phone: `parseNigerianPhone` ok and ≤ 20 characters as sent.
    - `eventProblems(s: EventSelection, packages: TicketPackage[], questions: CustomQuestion[], free: boolean): EventProblem[]`, where `type EventProblem = 'noTickets' | 'tooMany' | 'overStock' | { question: string } | 'guestName' | 'guestEmail' | 'guestPhone'`. `guestName` applies only when `free`.
  - **Event rules:**
    - `ticketLines(qty: Record<string, number>): Record<string, number>`: positive integers only, drops zero, NaN, negative and non-integer values (P18).
    - `MAX_TICKETS = 20`
    - `isFreeOrder(s: EventSelection, packages: TicketPackage[], listingPrice: number): boolean`. A package-less listing with `listingPrice > 0` is never free (P19). Free means the subtotal after the promo preview is 0.
    - `eventSubtotal(qty, packages, listingPrice): number`
  - **Idempotency:** `selectionFingerprint(kind: 'hotel'|'apartment', listingId: string, roomTypeId: string|null, s: StaySelection): string`, a stable JSON of everything sent at create.
- [ ] **Step 1:** Write tests:
  - `defaultRate` covers requested, foreign requested, is_default, cheapest and none.
  - `nights('2026-11-01','2026-11-04') === 3`.
  - `stayProblems`: past check-in gives `dates`; equal dates give `dates`; 91 nights gives `dates`; 1 night with min 2 gives `minNights`; 5 guests with max 4 gives `maxGuests`; a bad email gives `guestEmail`.
  - `ticketLines({A:3,B:-1,C:0,D:2.5,E:NaN})` gives `{A:3}`.
  - `eventProblems`: 21 tickets gives `tooMany`; 0 tickets gives `noTickets`; above `remaining` gives `overStock`; an empty required question gives `{question:'q1'}`.
  - `isFreeOrder`: all packages at 0 → true; package-less with price 5000 → false; a promo bringing 2000 to 0 → true.
  - `selectionFingerprint` is equal for the same selection and different when adults change.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS. **Step 5:** Commit `feat(customer): checkout selection rules`.

### Task 4: Create requests and outcomes

**Files:**

- Create: `src/features/customer/domain/checkout/createRequest.ts`, `src/features/customer/domain/checkout/createOutcome.ts`
- Test: `src/features/customer/domain/checkout/__tests__/createRequest.test.ts`, `…/createOutcome.test.ts`

**Interfaces:**

- Consumes: Task 3 types, `ApiError`.
- Produces:
  - **Request bodies:**
    - `hotelBody(roomTypeId: string, hotelId: string, s: StaySelection): object`. Keys: `room_type_id`, `hotel_id`, `rate_id` (omitted when null), `check_in_date`, `check_out_date`, `adults`, `children`, `breakfast_selections` (`[{option_id, quantity}]`, quantity > 0 only, omitted if empty), `airport_transfer`, plus `airport_transfer_type` and `airport_code` (only when on; code omitted when null), `promo_code_id` (when set), `guest_name`, `guest_email`, `guest_phone`, `special_requests` (omitted when blank).
    - `apartmentBody(apartmentId: string, s: StaySelection): object`. Keys: `apartment_id`, dates, `number_of_guests` (= adults + children), airport fields as above, guest fields, `special_requests`. **Never** `promo_code_id` (P9).
    - `eventBody(listingId: string, s: EventSelection, free: boolean): object`. Keys: `listing_id`, `contact_email`, `contact_phone`, plus `contact_name` when free, `ticket_details: ticketLines(qty)`, `custom_answers` (non-blank answers only, each trimmed to 500), `promo_code_id` when set and not free.
  - **Outcomes:**
    - `type CreateOutcome = { kind: 'created' } | { kind: 'refused'; words: string; field?: StayProblem } | { kind: 'unsure' } | { kind: 'wait'; seconds: number } | { kind: 'busy'; seconds: number } | { kind: 'failed'; words: string; strayBookingId: string|null }`
    - `stayCreateOutcome(e: ApiError): CreateOutcome`
    - `eventCreateOutcome(e: ApiError): CreateOutcome`
    - The `created` case is built by the caller.
  - **Exact words (spec P13):**
    - `dates_invalid` → "Choose check-out after check-in, from today" (`field: 'dates'`)
    - `min_nights` → "At least {n} nights" (n from body `min_nights`)
    - `max_guests` → "Up to {n} guests"
    - `unavailable`, hotel → "No rooms left for these dates"
    - `unavailable`, apartment → "These dates were just booked. Try other dates"
    - `not_found` / 404 → "This listing isn't available any more"
    - `in_progress` → `busy` with `retry_after` (default 2)
    - `idempotency_mismatch` → `unsure`
    - 400 `invalid_input` → the first `details` message, else "Check your details"
    - unknown 409 → the body's `error` text, else "This can't be booked right now"
    - 503 `booking_failed`/`addons_failed` → `failed` "Couldn't book. Try again" with `strayBookingId` from the body's `booking_id`
    - 429 → `wait`
    - network, timeout or other 5xx → `unsure`
    - Events: 409 → "Not enough tickets left"; 404 → not available; 400 → the body's `error` text, else "Check your tickets"
- [ ] **Step 1:** Write tests:
  - `hotelBody` never contains `total`, `amount` or `price` keys;
  - `apartmentBody` has no `promo_code_id` even when `s.promo` is set;
  - `eventBody({A:2,B:-1})` sends `{A:2}`;
  - free adds `contact_name` and drops the promo;
  - one test per word mapping above, including `strayBookingId` and the `min_nights` interpolation.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(customer): checkout create bodies and outcomes`.

### Task 5: Payment status and flow

**Files:**

- Create: `src/features/customer/domain/checkout/paymentStatus.ts`, `src/features/customer/domain/checkout/paymentFlow.ts`
- Test: `…/__tests__/paymentStatus.test.ts`, `…/__tests__/paymentFlow.test.ts`

**Interfaces:**

- Consumes: Task 2 types.
- Produces:
  - **Status mapping:**
    - `type PayVerdict = 'paid' | 'failed' | 'pending' | 'unknown'`
    - `fromPaymentState(p: PaymentState): PayVerdict`. Paid = `status === 'completed' && fulfilled`. `completed` but not fulfilled → pending. `failed`, `expired` or `abandoned` → failed. Anything else → pending.
    - `fromVerified(v: Verified): PayVerdict`
  - **Polling:** `POLL_SCHEDULE_MS = [2000, 3000, 5000, 8000, 13000]`, `POLL_EVERY_MS = 15000`, `POLL_MAX_MS = 180000`, and `nextPollDelay(elapsedMs: number, attempt: number): number | null` (null once elapsed would exceed max).
  - **Hold window:** `HOLD_MS = 25 * 60_000` and `holdEndsAt(kind: 'hotel'|'apartment'|'event', createdAtIso: string): number | null` (null for events).
  - **Stored URLs and pending references:** `URL_MAX_AGE_MS = 24 * 3600_000`, `PENDING_REINIT_MS = 15 * 60_000`.
  - **What Pay does:** `type PayPlan = { do: 'done' } | { do: 'open'; reference: string; url: string } | { do: 'verifyPending'; reference: string } | { do: 'initialize' }` and `planPay(check: CheckStatus, stored: { reference: string; paymentUrl: string; startedAt: number } | null, nowMs: number): PayPlan`. It implements P4 and P26:
    - hasPaid → done;
    - pending and stored with the same reference and URL age < 24 h → open;
    - pending otherwise → verifyPending;
    - neither → initialize.
  - `afterPendingVerify(v: PayVerdict, pendingCreatedAtIso: string, nowMs: number): 'done' | 'initialize' | 'wait'`: paid → done; failed → initialize; pending or unknown with age ≥ 15 min → initialize; otherwise wait.
  - **The flow reducer:**
    - `type FlowState = { step: 'review' } | { step: 'starting' } | { step: 'inBrowser'; reference: string } | { step: 'checking'; reference: string; startedAt: number; attempt: number } | { step: 'done' } | { step: 'failed' } | { step: 'stillChecking'; reference: string } | { step: 'holdEnded' } | { step: 'startError'; words: string } | { step: 'pendingElsewhere' }`
    - `type FlowEvent = { type: 'pay' } | { type: 'opened'; reference: string } | { type: 'returned'; now: number } | { type: 'verdict'; verdict: PayVerdict; now: number } | { type: 'startFailed'; words: string } | { type: 'holdExpired' } | { type: 'checkAgain'; now: number } | { type: 'paid' } | { type: 'pendingElsewhere' }`
    - `flow(state: FlowState, ev: FlowEvent): FlowState`:
      - `pay` is ignored unless the step is review or startError;
      - `holdExpired` moves review or startError to holdEnded and leaves the other steps alone;
      - `verdict` paid → done; failed → failed; pending or unknown → stays checking with attempt + 1, or becomes stillChecking once `nextPollDelay` returns null.
  - **Initialise errors:** `startErrorWords(e: ApiError): string`:
    - 409 `booking_total_invalid` → "This booking's price couldn't be confirmed. Start again"
    - 403 → "This booking isn't on your account"
    - 404 → "Booking not found"
    - anything else → "Couldn't start payment. Try again"
- [ ] **Step 1:** Write tests:
  - `fromPaymentState` covers completed+fulfilled → paid, completed+unfulfilled → pending, failed → failed, and waiting → pending.
  - `nextPollDelay(0,0)===2000`, `(31000,5)===15000`, and returns null at 180 s.
  - `hold window closes at 25 minutes`: `holdEndsAt('hotel', iso)` = created + 1 500 000 ms; events → null.
  - `planPay` covers all four branches, including a stored URL 25 h old → verifyPending.
  - `afterPendingVerify`: 14 min → wait, 15 min → initialize.
  - `flow`:
    - a double `pay` from starting stays starting;
    - `verdict` failed → failed;
    - exhausting polls → stillChecking;
    - `holdExpired` during checking is ignored.
  - `startErrorWords`: 503 gives the try-again text, never a refusal.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(customer): payment flow and status rules`.

### Task 6: Checkout store

**Files:**

- Create: `src/features/customer/offline/checkoutStore.ts`
- Test: `src/features/customer/offline/__tests__/checkoutStore.test.ts`

**Interfaces:**

- Consumes: `KeyValue`, `plainKv` (`@/shared/platform/storage`), `registerAlwaysWipe`.
- Produces:
  - **Entry:** `type CheckoutEntry = { userId: string; kind: 'hotel'|'apartment'|'event'; bookingId: string; listingId: string; title: string; createdAt: string; total: number; pricing: Record<string, number|null> | null; summary: { checkIn?: string; checkOut?: string; guests?: number; roomName?: string; eventDate?: string; tickets?: number }; guestEmail: string; payment: { reference: string; paymentUrl: string; startedAt: number } | null }`
  - **Store:** `createCheckoutStore(kv: KeyValue)` with:
    - `put(e)`
    - `get(userId, kind, bookingId): CheckoutEntry|null`
    - `setPayment(userId, kind, bookingId, payment)`
    - `drop(userId, kind, bookingId)`
    - `list(userId): CheckoutEntry[]`, which skips and deletes entries whose `createdAt` is older than 24 h
    - `wipe()`
  - **Storage layout:** keys use the prefix `bh.checkout.` plus an index key `bh.checkout-index`, capped at 50 entries (the oldest are dropped).
  - **Export:** `checkoutStore = createCheckoutStore(plainKv)`, registered with `registerAlwaysWipe` on import.
- [ ] **Step 1:** Write tests with an in-memory KeyValue:
  - put/get round trip;
  - `setPayment` keeps the pricing;
  - `list` drops a 25-hour-old entry;
  - the 51st put evicts the oldest;
  - `wipe` empties;
  - another user's entries are invisible;
  - a corrupt JSON value reads as null.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(customer): checkout store survives a kill`.

### Task 7: Checkout API and reads

**Files:**

- Create: `src/features/customer/api/checkoutApi.ts`, `src/features/customer/api/checkoutDb.ts`
- Test: `src/features/customer/api/__tests__/checkoutApi.test.ts`, `…/checkoutDb.test.ts`

**Interfaces:**

- Consumes: Task 2 schemas, `ApiClient['request']`, `SupabaseLike` (as in `listingDetailDb.ts`).
- Produces in `checkoutApi.ts` (each takes `c: Pick<ApiClient,'request'>` first):
  - **Create:**
    - `createStay(c, kind: 'hotel'|'apartment', body: object, idemKey: string)`: POST `/api/bookings/{kind}`, `idempotent: true`, `headers: {'Idempotency-Key': idemKey}`.
    - `createEvent(c, body: object, free: boolean)`: POST `/api/bookings/event/free` or `/api/bookings/event/create`; not idempotent.
  - **Before create:**
    - `roomAvailability(c, roomTypeId, checkIn, checkOut)`: GET `/api/hotels/room-types/{id}/availability?checkIn=…&checkOut=…`, `auth: false`.
    - `validatePromo(c, {code, service_type, service_id, amount})`: POST `/api/promo/validate`, `auth: false`.
    - `serviceCharge(c, type)`: GET `/api/service-charges?type=…`, `auth: false`.
  - **Payment:**
    - `initializePayment(c, kind, bookingId, email)`: POST `/api/payment/initialize` with the body exactly `{ requestId, requestType: kind, provider: 'paystack', currency: 'NGN', email }`.
    - `checkPayment(c, kind, bookingId)`: POST `/api/payment/check-status` `{requestId, requestType}`.
    - `verifyPayment(c, reference)`: POST `/api/payment/verify` `{reference, provider: 'paystack'}`.
    - `paymentState(c, reference)`: GET `/api/payment/status/{encodeURIComponent(reference)}`.
  - Every function returns `Promise<Result<T, ApiError>>`.
- Produces in `checkoutDb.ts`:
  - `type CheckoutDb = { eventQuestions(listingId): Promise<CustomQuestion[]>; hotelExtras(hotelId): Promise<HotelExtras>; apartmentExtras(apartmentId): Promise<ApartmentExtras>; findRecentEventBooking(userId, listingId, sinceIso): Promise<{ id: string; created_at: string } | null> }`
  - `type HotelExtras = { breakfastOffered: string|null; breakfast: { id: string; name: string; pricePerPerson: number }[]; airportEnabled: boolean; airportPrices: Record<string, number>; airportFee: number|null }`; `type ApartmentExtras = { airportEnabled: boolean; airportPrices: Record<string, number>; minimumStay: number }`
  - **Reads (explicit columns only):**
    - `listings.custom_questions`;
    - `hotels(breakfast_offered, airport_transfer_enabled, airport_prices, airport_transfer_fee)`;
    - `hotel_breakfast_options(id, name, price_per_person, is_available)` where `is_available`;
    - `serviced_apartments(airport_transfer_enabled, airport_prices, minimum_stay)`;
    - `event_bookings(id, created_at)` where `customer_id = userId`, `listing_id`, `status = 'pending'` and `created_at >= sinceIso`, newest first, limit 1.
  - Check the column names against `../web/supabase/migrations/20261004121044_baseline_from_prod.sql` before coding, and adjust the names if the baseline differs (record it in the report).
  - Export `checkoutDb = createCheckoutDb(liveClient)`.
- [ ] **Step 1:** Write tests with a fake requester and a fake supabase:
  - `initialize body has no amount or metadata` (assert exact keys);
  - `createStay sends Idempotency-Key and idempotent:true`;
  - `createEvent is not idempotent`;
  - `paymentState encodes the reference`;
  - `hotelExtras drops unavailable breakfast options and non-numeric airport prices`;
  - `findRecentEventBooking filters by user, listing, pending and since`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(customer): checkout API and reads`.

### Task 8: Checkout hooks

**Files:**

- Create:
  - `src/features/customer/hooks/useCheckoutData.ts`: extras, questions, availability, service charge queries.
  - `src/features/customer/hooks/useCreateBooking.ts`
  - `src/features/customer/hooks/usePayment.ts`
  - `src/features/customer/hooks/useResumePayments.ts`
- Modify: `src/features/customer/hooks/customerKeys.ts` (checkout keys)
- Test: `src/features/customer/hooks/__tests__/useCreateBooking.test.tsx`, `…/usePayment.test.tsx`, `…/useResumePayments.test.tsx`

**Interfaces:**

- Consumes: Tasks 3–7, `useServerNow`, the existing cancel API (`cancelBooking` in `bookingActionsApi.ts`), the API client instance and the session user id as used by `useBookingActions`.
- Produces:
  - **`useCreateBooking(kind, listingId)`** → `{ submit(selection, ctx): Promise<void>; state: { phase: 'idle'|'sending'|'unsure'|'busy'|'refused'|'failed'; words?: string; field?: StayProblem; waitSeconds?: number }; created: { bookingId: string } | null; checkAgain(): Promise<void> }`.
    - **Stays:** the idempotency key is kept while `selectionFingerprint` is unchanged; `busy` waits `seconds` and retries the same key up to 3 times, then mints a new key.
    - **Writes:** on created, `checkoutStore.put` (P28) runs before `created` is set.
    - **Stray bookings:** on `failed` with `strayBookingId`, `cancelBooking` runs fire-and-forget.
    - **Events:** an `unsure` answer records `sentAt`; `checkAgain` calls `findRecentEventBooking(userId, listingId, sentAt − 5000)` and adopts the row, or returns to idle.
  - **`usePayment(kind, bookingId)`** → `{ state: FlowState; pay(): void; checkAgain(): void; leave(): void; holdEndsAt: number|null; entry: CheckoutEntry|null }`.
    - **`pay`:**
      - Runs `checkPayment` → `planPay` → (verifyPending → `afterPendingVerify`) → initialise.
      - It writes `checkoutStore.setPayment` **before** `WebBrowser.openBrowserAsync(url, { createTask: false, showInRecents: false })`.
    - **Return detection:**
      - iOS: `returned` when the promise resolves with `cancel` or `dismiss`.
      - Android (`Platform.OS === 'android'`): `returned` on the next `AppState` change to `active` after opening.
    - **On return:** `verifyPayment` once, then `paymentState` on the `nextPollDelay` schedule (timers cleared on unmount). Done or failed drops the entry and invalidates `customerKeys` bookings, booking(kind,id) and the ticket wallet.
    - **`leave()`:** if the step is review, startError or holdEnded and no payment was ever started, it calls `cancelBooking` (P7, fire-and-forget) and drops the entry.
    - **Hold:** fires `holdExpired` when `useServerNow()` passes `holdEndsAt`.
  - **`useResumePayments()`**, mounted once in the customer layout: on mount and when AppState becomes active, for each `checkoutStore.list(userId)` entry with a `payment`, it runs verify then one status read. Paid or failed drops the entry and invalidates bookings; anything else is left as is. It runs one entry at a time and never initialises.
- [ ] **Step 1:** Write tests, mocking `expo-web-browser` and `AppState`:
  - `pay twice sends one initialise`;
  - `pending reference with fresh stored url reopens it without initialise`;
  - `entry is written before the browser opens` (assert call order);
  - `ios starts checking when the browser promise resolves`;
  - `android starts checking on AppState active` (the promise resolves `opened` first; no verify until active);
  - `failed verdict shows failed and drops the entry`;
  - `resume after kill verifies and never initialises`;
  - `leave on review cancels the unpaid booking`;
  - `leave after payment started never cancels`;
  - `stay create reuses the idempotency key for the same selection and mints a new one when it changes`;
  - `event create lost answer adopts the pending row`;
  - `busy retries three times then mints a new key`.
- [ ] **Step 2–4:** FAIL → implement → PASS (use fake timers for polling). **Step 5:** Commit `feat(customer): checkout and payment hooks`.

### Task 9: Shared Stepper and DatesSheet

**Files:**

- Create: `src/shared/ui/Stepper.tsx`, `src/shared/ui/DatesSheet.tsx`; export both from `src/shared/ui/index.ts`
- Test: `src/shared/ui/__tests__/Stepper.test.tsx`, `…/DatesSheet.test.tsx`

**Interfaces:**

- Produces:
  - **`Stepper`:** `Stepper({ label: string; value: number; min: number; max: number; onChange(n: number): void; testID?: string })`. Buttons are 44 pt with a `−`/`+` icon (lucide `Minus`/`Plus`). The accessibility label is "{label}, {value}"; the buttons are "Decrease {label}" and "Increase {label}". Each button is disabled at its limit, and `accessibilityRole="adjustable"` carries increment/decrement actions.
  - **`DatesSheet`:** `DatesSheet({ visible: boolean; today: string; months?: number /* default 12 */; minNights: number; initial: {checkIn: string|null; checkOut: string|null}; onDone(range: {checkIn: string; checkOut: string}): void; onClose(): void })`.
    - **Layout:** a modal sheet with a header reading "Check-in → Check-out" (`EEE d MMM`), and a FlatList of months, each a 7-column grid starting on Monday.
    - **Selection:** past days are disabled. The first tap sets check-in; a later tap sets check-out; a tap on or before check-in restarts.
    - **Button:** "Choose · {n} nights" (n = 1 → "1 night"), disabled until check-out is set and nights ≥ `minNights`. A `minNights > 1` line reads "At least {n} nights".
    - **Constraints:** no animated layout props, and no new dependency.
- [ ] **Step 1:** Write tests:
  - Stepper: `+` calls onChange(value+1); `−` is disabled at min; the accessibility label reads correctly.
  - DatesSheet: tapping today then +3 days enables "Choose · 3 nights"; a past day is disabled; tapping before check-in restarts; `minNights 2` with 1 night keeps the button disabled and shows "At least 2 nights".
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(ui): stepper and dates sheet`.

### Task 10: Select screen

**Files:**

- Create:
  - `src/features/customer/screens/SelectScreen.tsx`
  - `src/features/customer/ui/checkout/StaySelect.tsx`
  - `src/features/customer/ui/checkout/EventSelect.tsx`
  - `src/features/customer/ui/checkout/GuestFields.tsx`
  - `src/features/customer/ui/checkout/PromoRow.tsx`
  - `src/features/customer/ui/checkout/ExtrasSection.tsx`
  - `src/app/(customer)/checkout/[kind]/[listingId].tsx`
- Modify: `src/app/(customer)/_layout.tsx` (register `checkout/[kind]/[listingId]` as a stack screen)
- Test: `src/features/customer/screens/__tests__/SelectScreen.test.tsx`

**Interfaces:**

- Consumes:
  - `useListing` (existing);
  - Task 8 hooks;
  - Task 3 rules;
  - Task 9 UI;
  - `TicketTypeRow` (existing; add an optional `stepper` slot if needed);
  - `useProfile` for the guest prefill.
- Produces:
  - **Route:** `/checkout/{kind}/{listingId}?roomType=&rate=` (kind = hotel|apartment|event). It parses `kind` with the existing `routeParams` helpers; an unknown kind shows `ListingNotFound`.
  - **Behaviour:**
    - **Hotel:** room summary, Bed option (P25), dates row → DatesSheet, adults/children steppers (max = `max_occupancy`), breakfast (P10) when `breakfast_offered === 'paid'`, airport (P10), promo (P9), guest fields, special requests (≤1000 with CharCounter). After the dates are set, availability (P11).
    - **Apartment:** dates (min nights from `minimum_stay`), guests (max `max_guests`), airport, guest fields. No promo.
    - **Event:** a package row per package with a stepper (0–min(20, remaining)); "Sold out" when remaining is 0; "{n} left" when ≤ `low_stock_threshold`; the line "Up to 20 tickets per booking"; questions (P17); promo; guest fields (name required only when free).
  - **Footer:**
    - Estimate: stays show "{n} nights · ₦{rate×nights}"; events show "{n} tickets · ₦{subtotal}" and "Free" when free.
    - **Continue** shows inline problems (first problem focused). Then:
      - `submit`: created → `router.replace('/pay/{kind}/{bookingId}')`;
      - free event created → `/pay/event/{id}?free=1`;
      - refused → words beside the field or above the footer;
      - unsure → Banner "Couldn't confirm your booking" with **Check again**;
      - wait → `RateLimitWait`.
  - The screen is unreachable when the kind's switch is off (it renders `ListingNotFound`).
- [ ] **Step 1:** Write screen tests with mocked hooks:
  - `continue disabled until dates chosen` (hotel);
  - `min nights line shows for apartments`;
  - `event steppers cap at 20 total and show Up to 20 tickets per booking`;
  - `required question blocks continue with its message`;
  - `free event shows Free and requires a name`;
  - `refused dates_invalid shows the words`;
  - `unsure shows Check again`;
  - `stays switch off renders not found`.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(customer): checkout select screen`.

### Task 11: Pay screen (Review, Checking, Done)

**Files:**

- Create:
  - `src/features/customer/screens/PayScreen.tsx`
  - `src/features/customer/ui/checkout/PriceDetails.tsx`
  - `src/features/customer/ui/checkout/PayStates.tsx` (Checking, Failed, StillChecking, HoldEnded, PendingElsewhere)
  - `src/features/customer/ui/checkout/BookedDone.tsx`
  - `src/app/(customer)/pay/[kind]/[bookingId].tsx`
- Modify: `src/app/(customer)/_layout.tsx` (register `pay/[kind]/[bookingId]`, `gestureEnabled: false`)
- Test: `src/features/customer/screens/__tests__/PayScreen.test.tsx`

**Interfaces:**

- Consumes: `usePayment`, `useBooking` (existing, for the fallback total), `serviceCharge` via `useCheckoutData`, `maskEmail`, `Banner`, `Button`, `Screen`, haptics as used by the existing outcome screens.
- Produces (spec §5, P8, P14, P20, P28):
  - **Review:**
    - **Booking summary:** title; dates or event time; room or tickets.
    - **Your details:** read-only.
    - **Price details:** the cached `pricing` lines when present, else total only. Then "{label ?? 'Service charge'}" (estimate) and **Total**. The charge is `charge_value`% of total, to 2 dp, when `charge_type === 'percentage'`; otherwise `charge_value`. It is omitted when `charge` is null or disabled.
    - **Hold line:** "We're holding this for you until {h:mm a}" for stays.
    - **Buttons:** **Pay ₦{total + charge}**, and a secondary **Cancel booking**, which calls `leave()` then `router.back()`.
    - **Terms:** "You'll pay on Paystack's secure page. We confirm the payment with Paystack before booking it." sits above the button.
  - **Starting:** the button shows a spinner and is disabled.
  - **startError:** a Banner with the words and **Try again**.
  - **Checking:** "Checking your payment", a spinner and "This can take up to a minute". Nothing is pressable; the hardware back is blocked while checking.
  - **Failed:** "Payment didn't go through. You weren't charged.", **Try again** (back to Review; it re-runs P4) and **Go to Bookings**.
  - **StillChecking:** "We're still checking. If you paid, it'll show in Bookings shortly.", **Check again** and **Go to Bookings**.
  - **HoldEnded:** "This hold has ended. Start again to book these dates.", **Start again**, which goes to Select with the same listing.
  - **PendingElsewhere:** "A payment for this booking is still open. If you didn't finish it, try again in a few minutes." with **Check again**.
  - **Done (`BookedDone`):**
    - Success tone, check icon and "You're booked"; title, dates or event time; "Confirmation sent to {maskEmail(email)}".
    - **View tickets** (event → `/tickets/{bookingId}`) or **View booking** (`/my-booking/{kind}/{id}`), plus **Done** (→ `/explore`).
    - A success haptic on mount, and the tier-1 tick from MOTION.md (a Reanimated opacity and scale on the icon, ≤ 300 ms, honouring reduce-motion).
  - **Free events:** `?free=1` shows Done directly.
  - **Leaving Review:** leaving by back or swipe calls `leave()` (P7). Use `navigation.addListener('beforeRemove')` and skip it once a payment has started.
- [ ] **Step 1:** Write screen tests, mocking `usePayment` states:
  - review shows the server total and the "Pay ₦…" label including the service charge;
  - `total-only layout without cached pricing`;
  - the hold line shows for hotel and not for event;
  - `hold ended swaps Pay for Start again`;
  - checking blocks back;
  - failed shows "You weren't charged";
  - stillChecking offers Check again;
  - done shows View tickets for event and View booking for hotel;
  - `back from review calls leave`;
  - a 503 start error reads try-again text.
- [ ] **Step 2–4:** FAIL → implement → PASS. **Step 5:** Commit `feat(customer): pay screen with review, checking and confirmation`.

### Task 12: Wire listings and bookings to checkout

**Files:**

- Modify:
  - `src/features/customer/screens/ListingScreen.tsx`
  - `src/features/customer/ui/ListingFooter.tsx`
  - `src/features/customer/ui/RoomTypeCard.tsx`
  - `src/features/customer/ui/BookingFrame.tsx`
  - `src/app/(customer)/_layout.tsx` (mount `useResumePayments`)
  - `src/features/customer/screens/TourScreen.tsx` (copy)
- Test: extend `ListingScreen`, `BookingScreen` and `RoomTypeCard` tests under `src/features/customer/screens/__tests__/` and `ui/__tests__/`

**Interfaces:**

- Consumes: the switches (Task 1), `checkoutStore`, `holdEndsAt`, `useServerNow`.
- Produces:
  - **Listing footer:**
    - When the kind's switch is on (stays: `CHECKOUT_STAYS_ENABLED`; event: `CHECKOUT_EVENTS_ENABLED`, and both need `CHECKOUT_PAYMENTS_ENABLED` unless the event is free), the footer button reads **Book** (hotel: "Choose a room" scrolls to rooms) or **Get tickets** (event) without the external-link icon, and navigates to Select.
    - When a switch is off, the 4b hand-off is unchanged (the existing tests keep passing).
  - **RoomTypeCard:** when stays are on, it gains **Select** → `/checkout/hotel/{hotelId}?roomType={id}`.
  - **BookingFrame pending banner (P21):**
    - with a checkout entry that has a payment → "Checking your payment…";
    - else, payments on and (event, or stay within `holdEndsAt`) → **Pay now** (`/pay/{kind}/{id}`);
    - else, a stay past its hold → "This hold has ended" with **Book again** (`/listing/{kind}/{listingId}` when known);
    - else, the existing web hand-off.
  - **TourScreen:** the "For now you book and pay on bookhushly.com" copy changes to "Book and pay in the app or on bookhushly.com. You see the full price before you pay." only when `CHECKOUT_EVENTS_ENABLED`.
- [ ] **Step 1:** Write tests:
  - `event footer opens checkout when events switch on`;
  - `hotel footer keeps web hand-off while stays switch off`;
  - `pending event booking shows Pay now`;
  - `stale pending stay shows hold ended`;
  - `booking with a stored payment shows Checking your payment`.
- [ ] **Step 2–4:** FAIL → implement → PASS (the full `npx jest`, `tsc` and lint must pass). **Step 5:** Commit `feat(customer): book from listings and pay pending bookings in the app`.

### Task 13: Docs and phone checklist

**Files:**

- Create: `docs/device-tests/2026-10-21-phone-checks-phase-4c-checkout.md`
- Modify: `docs/MOBILE_APP_REQUIREMENTS.md` (FR-2.3/2.4/2.5/2.9/2.9a phase notes), `docs/ENGINEERING_STANDARDS.md` only if a payment rule is missing

**Phone checklist contents** (same voice and structure as `2026-10-19-phone-checks-phase-5-extras.md`), Moto G06 plus an iPhone if available, Paystack **test** card. Parts:

- **A.** Paid event: 2 tickets, then pay, then Done, then View tickets with a live code.
- **B.** Free event registration.
- **C.** Kill the app on the Paystack page after paying; reopen; Bookings shows it paid; no second charge in Paystack's dashboard.
- **D.** Payment failure with the test decline card: "You weren't charged", then Try again.
- **E.** Back out of Review on a future-dated booking: the booking is cancelled (web shows cancelled).
- **F.** Pay now from Bookings on a pending event.
- **G.** Largest text and TalkBack on Select, Pay and Done.
- **H.** Stays (only after the owner flips `CHECKOUT_STAYS_ENABLED` once #221 is live): hotel with breakfast, apartment with min nights, and the hold ended after 25 min.

**Clean-up:** refund or cancel everything. **Tell me:** what each payment state said, and how long checking took.

- [ ] **Step 1:** Write the checklist and update the requirement notes.
- [ ] **Step 2:** Run `npx prettier --write` on the touched docs.
- [ ] **Step 3:** Commit `docs(4c): phone checks and requirement notes`.
