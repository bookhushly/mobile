# Web routes for vendor mode (request-for-quote vendors first)

**For:** a Claude Code session (or developer) working in the **web** repo (`bookhushly/web`), producing one PR (or two: P0, then P1).
**Why:** the owner reversed "vendors stay on web" (mobile DECISION-11, 2026-11-25). The app's vendor mode starts with request-for-quote work for car rental, logistics and security companies. On the web this work runs as server actions, which the app can't call (it talks HTTP with a Bearer token). Several of those actions also trust a `vendorId` sent by the client.
**Written:** 2026-11-25, from reading web `main` (`app/actions/{marketplace,logistics,security,car-rental,vendor}.js`, `app/api/wallet/*`, `lib/notifications.js`). Branch from the latest `origin/main` and re-read the actions before wiring, because they may have moved.

## Principles

These are the same as `2026-11-23-rfq-web-routes.md` (web PR 242), which the customer side already uses.

1. **Wrap, don't fork.** Each route authenticates, validates, calls the existing action (or its inner logic), and maps the result to HTTP.
   - Fan-out, notifications, the 48 h offer expiry, commission and payout stay where they are.
   - Where an action takes a `vendorId` argument, the route passes the vendor it derived from the token.
   - Add a small `resolveVendorFromUser(user.id)` helper if one doesn't exist, and have the actions use it too.
2. **Vendor from the token, never the body.** `getAuthUser()`, then the vendor row by `user_id`.
   - No vendor row: 403 `not_a_vendor`.
   - `approved = false`: 403 `vendor_not_approved`.
   - `suspended_at` set: 403 `vendor_suspended`.
   - `/api/vendor/me` is the one exception: it answers for unapproved and suspended vendors so the app can say why.
3. **Every error carries a `code`.** Use the shape `{ error, code }`.

   | HTTP | `code` | When |
   |---|---|---|
   | 400 | `bad_request` | The body fails zod (include `issues`) |
   | 401 | `unauthorized` | Nobody is signed in |
   | 403 | `not_a_vendor` / `vendor_not_approved` / `vendor_suspended` / `wrong_category` | See above; `wrong_category` when the request type isn't the vendor's `business_category` |
   | 404 | `not_found` | No such request, offer or job, or it isn't the vendor's |
   | 409 | `request_not_open` | Quoting a request that is no longer open or has expired |
   | 409 | `already_offered` | The vendor already has a pending offer on it |
   | 409 | `offer_not_pending` | Withdrawing an offer that was accepted, rejected or expired |
   | 409 | `wrong_status` | Start, complete or a milestone in the wrong job status (include `status`) |
   | 429 | `rate_limited` | From the tier limiter (keep `Retry-After`) |
   | 503 | `server_error` | Anything else (log it; don't leak the message) |
4. **Rate tier:** `user` for everything here, keyed per user, not per IP.
5. **`Cache-Control: no-store, private`** on every response.
6. **Path segment → type:** `car-rental` → `car_rental`, `logistics` → `logistics`, `security` → `security`. Reuse the helper from PR 242.
7. **Never return the customer's email.** Show the customer's phone only once the job is `paid` or later, as `getVendorJobs` does today.

## P0: what vendor mode v1 can't ship without

### 1. `GET /api/vendor/me`
Returns `{ vendor: { id, business_name, business_category, approved, status, suspended, rejection_reason, states: string[] } }`. The `states` come from `vendor_service_areas`.

The app uses this at sign-in to choose vendor mode, and to show "Waiting for approval" or "Your account is suspended" instead of an empty inbox. Return 404 `not_a_vendor` when the user has no vendor row.

### 2. `GET /api/vendor/rfq/requests?page=&pageSize=`
Lists the open requests this vendor can quote. It wraps `getOpen{CarRental|Logistics|Security}Requests` for the vendor's `business_category` and service states. The vendor comes from the token, not from a `vendorId` argument.

- Exclude requests this vendor has already bid on, as today.
- `pageSize` is at most 50.
- Response: `{ requests: [...], count, page, pageSize, requestType }`.

Each request needs:
- `id`, `created_at` and `expires_at`;
- what the customer asked for: the same fields the customer's request detail has, minus contact details;
- `offer_count`, so the vendor sees the competition.

### 3. `GET /api/vendor/rfq/requests/{type}/{id}`
Returns one open request in full (no email or phone), plus the vendor's own offer if there is one. The app opens this from a push notification.

Return 404 when the type isn't the vendor's category or the state isn't one they serve, so knowing an id reveals nothing.

### 4. `POST /api/vendor/rfq/requests/{type}/{id}/offers`
Sends a quote. It wraps `submit{CarRental|Logistics|Security}Offer`.

- **Body:** `{ amount, message?, breakdown?, image_urls?, pricing_model? (car rental), vehicle_id?, driver_id? (car rental, logistics), guard_ids? (security), idempotency_key }`.
- **Validate server side:**
  - `amount` is an integer number of naira from 1,000 to 100,000,000;
  - `message` is at most 1,000 characters;
  - `image_urls` holds at most 6 items, each one of our own upload URLs (see §8);
  - vehicles, drivers and guards must belong to this vendor, as the actions already check.
- **Fixes while here:**
  - `submitCarRentalOffer` doesn't check `business_category`: add the check (403 `wrong_category`).
  - Make "one pending offer per vendor per request" a unique partial index or compare-and-set, not a read then a write. A retried request then returns 409 `already_offered` with the existing offer.
- **Response:** 201 `{ offer }`.

### 5. `GET /api/vendor/rfq/offers?status=pending|accepted|rejected|withdrawn|expired`
The vendor's bids. It wraps `getVendorBids`, with the vendor from the token. Each item is the offer plus a short snapshot of its request (type, id, what, where, when, request status).

### 6. `POST /api/vendor/rfq/offers/{id}/withdraw`
Wraps `withdrawOffer`. Make it compare-and-set on `status = 'pending'`, so 0 rows returns 409 `offer_not_pending`. Response: 200 `{ offer }`.

### 7. Jobs
- **`GET /api/vendor/rfq/jobs?status=`** wraps `getVendorJobs` with the vendor from the token. It covers `matched`, `paid`, `in_progress`, `disputed` and `completed`.
  - Include `vendor_completed_at`, `customer_confirmed_at`, the customer's first name, and their phone from `paid` onward.
  - Include `payout_amount` (after commission) once it's known.
- **`GET /api/vendor/rfq/jobs/{type}/{id}`** returns one job.
- **`POST /api/vendor/rfq/jobs/{type}/{id}/start`** wraps `markJobStarted` for `paid` → `in_progress`. Make it compare-and-set; otherwise return 409 `wrong_status`.
- **`POST /api/vendor/rfq/jobs/{type}/{id}/complete`** wraps `markJobComplete`. It must be `in_progress`, and it is idempotent: if `vendor_completed_at` is already set, return 200 with the job.

### 8. Fix `markLogisticsMilestone`
It doesn't check `approved` today: add the check. Routing it is in P1 (below).

## P1: right after

### 9. `POST /api/vendor/rfq/jobs/logistics/{id}/milestone`
- **Body:** `{ milestone: "picked_up" | "in_transit" | "delivered", photo_url? }`. `photo_url` is required for `delivered`.
- Wraps `markLogisticsMilestone`: require `approved`, and reject a milestone that goes backwards (409 `wrong_status`).
- `delivered` completes the job, as today.

### 10. Uploads
Today `POST /api/upload` lets the client choose the `folder`. For vendor uploads, accept only `folder ∈ {offers, proof}` and store them under `vendors/{vendorId}/…`. Offers and milestones should accept only URLs from our Cloudinary account under that vendor's prefix. This also closes BACKEND_STATUS §9 gap 3 ("vendor and proof photos can be any https URL").

### 11. Wallet routes the app will call
- Add `code` to every error on `/api/wallet`, `/transactions`, `/statistics` and `/withdraw`.
- Move them to the `user` tier.
- Cap `/transactions?limit` at 100.
- `/withdraw` also needs:
  - `approved` required, and not suspended;
  - an `idempotency_key` (a retried tap must not pay out twice);
  - 409 `insufficient_balance` and `no_bank_account` codes.

- **`GET /api/vendor/bank-details` returns the full account number.** The app shows only the last two digits. Return `account_number_last2` (or a masked value) and keep the full number server side.
- **Withdrawals are reviewed by an admin** (`status: pending` → processing → completed or failed). Return the withdrawal's `id` and `status` from `/withdraw`, and list withdrawals with their status in `/transactions`, so the app can show "being checked", "on its way", "sent", and "didn't go through, money returned".

- **A vendor cancelling an apartment booking doesn't refund or notify the guest.** `POST /api/vendor/apartment-bookings/{id}/status` with `cancelled` only sets `booking_status` and `cancelled_at`. On a paid booking, the guest's money stays taken and they aren't told. Before vendor mode ships: start the refund (or queue it for an admin) and notify the guest, as the customer-side cancel does. The app currently tells the vendor to contact the guest and support.

- **Suspended or unapproved hotel owners can still run the front desk. High priority.**
  - Where: the vendor branch of `hotel_staff_can_manage` (used by check-in, check-out and reassign), the room-status route's vendor check, and the owner branches of the `hotel_bookings` / `hotel_rooms` policies all check ownership only. The same applies to `hotel_realtime_topic_allowed`.
  - The risk: a vendor suspended for fraud can read guest bookings, check guests in and out, and change rooms. They can do this through direct REST calls today, and through the app once vendor mode ships.
  - Fix: add `vendors.status <> 'suspended' and vendors.approved` (or the agreed rule) to each of these.
  - In the meantime, the app shows a suspended or unapproved owner's hotel as "not available".
- **`business_category` isn't protected by `protect_vendors_trust_fields`.** A vendor can change it themselves. Today that only unlocks a screen (no data, because ownership still decides), but it should be protected like `approved` and `status`.

### 12. Push deep links
Put `{ requestType, requestId }` in `data` for `new_request_available` in all three fan-outs. Logistics sends no `requestId` today. Do the same for `offer_accepted`, `offer_rejected` and `payout_released`, adding `offerId` where there is one. The app turns these into a screen.

**Confirm push is live.** `docs/mobile/PUSH_API.md` §6 says the migration wasn't applied when it was written. Confirm it's applied on production before the app registers tokens.

## P2: later (stays on web until then)
- Fleet (vehicles, drivers) and guards CRUD.
- Service areas and rates.
- KYC submit.
- Messages.
- Hotel, apartment and event vendor tools beyond what `/api/vendor/bookings` already gives.

## Known concerns to check while in there
- **`vo_vendor_manage_own`** covers ALL operations on `vendor_offers` with no separate WITH CHECK. A vendor may be able to `UPDATE` their own offer's `amount` or `status` straight through PostgREST, for example setting `accepted`. Add a trigger or narrow the policy so only `withdrawn` is reachable from the client, or revoke client UPDATE and use the routes only. **Unverified; check triggers first.**
- **`*_requests_select_open_marketplace`** lets any approved vendor read every open request, whatever their category or state. The route filters, but the table doesn't. Decide whether that's acceptable (no contact details are exposed).
- **`getOpen*Requests`, `getVendorBids` and `getVendorJobs`** take a client `vendorId` and do no auth check. RLS limits the damage, but they should derive the vendor too.

## Done means
- Every route above has a test for 401, for each 403 vendor code, for its 409s, and for the happy path.
- `docs/mobile/VENDOR_API.md` documents the contract (shapes, codes, examples), as `RFQ_API.md` does.
- The web vendor dashboard still works (it can keep calling the actions).

## Follow-ups after PR #248 (mobile, 2026-11-26)

The app's live layer is built against `docs/mobile/VENDOR_API.md`. These would close the remaining gaps:

1. Bookhushly's fee rate per request type in `GET /api/vendor/me` (e.g. `commission_rates: { car_rental: 10, … }`). Today the app reads it off past jobs, so a new vendor can't see what they'll receive before quoting.
2. `GET /api/vendor/fleet` (vehicles and drivers, ids and names) so a quote can name the vehicle.
3. `GET /api/vendor/events` with each event's capacity, tickets sold per type, and sales this week, for the event vendor's Today.
4. `/api/vendor/bookings`: add the room type to hotel stays, and paging (it returns every booking ever).
5. ~~Deploy PR #248 to production.~~ Live 2026-11-26; the app uses the live routes.
