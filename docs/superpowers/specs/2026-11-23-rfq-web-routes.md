# Web routes for request-for-quote services (car rental, logistics, security)

**For:** a Claude Code session (or developer) working in the **web** repo (`bookhushly/web`), producing one PR.
**Why:** the mobile app is adding car rentals, then logistics and security (Phase 6). On the web these flows run as server actions, which the app can't call (it talks HTTP with a Bearer token). This PR adds thin HTTP routes over the **existing** actions so both clients share one implementation.
**Written:** 2026-11-23, from reading web `main` (`app/actions/{car-rental,logistics,security,marketplace}.js`). Branch from the latest `origin/main`; re-read the actions before wiring, they may have moved.

## Principles

1. **Wrap, don't fork.** Each route authenticates, validates the JSON body, calls the existing action, and maps its result to HTTP. Vendor fan-out, notifications, TTL/expiry, the `trip_service_id` check and revalidation stay exactly as they are. No business logic in the routes.
2. **Bearer auth** through `getAuthUser()` from `@/lib/auth/session`, as `app/api/marketplace/report/route.js` does. 401 `{error, code:"unauthorized"}` when there's no user. Never take a user id from the body or query: the list route passes the authenticated `user.id`.
3. **Every error carries a `code`.** Shape `{ error: string, code: string }`. Add a `code` to each action's failure returns where the route needs to tell cases apart (non-breaking: the web UI keeps reading `error`). Codes used below:
   | HTTP | `code` | When |
   |---|---|---|
   | 400 | `bad_request` | Body fails validation (include `issues` from zod) |
   | 401 | `unauthorized` | No signed-in user |
   | 403 | `forbidden` | Not the caller's request |
   | 404 | `not_found` | No such request/offer |
   | 409 | `request_not_open` | Choosing an offer when the request isn't `open` |
   | 409 | `offer_unavailable` | Offer not `pending` or not on this request |
   | 409 | `not_cancellable` | Status not in `open, matched, paid, in_progress` |
   | 409 | `not_completable` | Confirm-complete in the wrong status |
   | 409 | `already_reviewed` | A review exists for this request |
   | 409 | `not_editable` | Edit after offers arrived or when not `open` |
   | 429 | `rate_limited` | From the tier limiter (keep its `Retry-After`) |
   | 500 | `server_error` | Anything else (log it; don't leak the message) |
4. **Rate tiers** from `lib/rate-limit/tiers.js`: writes use `user` (30/60 s); reads use `public` (60/60 s) like the existing `GET …/requests/{id}`.
5. **`Cache-Control: no-store`** on every response here (personal data).
6. **Path segment → table/type:** `car-rental` → `car_rental_requests` / `requestType: "car_rental"`; `logistics` → `logistics_requests` / `"logistics"`; `security` → `security_requests` / `"security"`. Use one small helper (the report route already has `requestTable`).

## Routes (car rental first; logistics and security are the same shape with their own actions)

All under `app/api/{car-rental|logistics|security}/requests/`.

### 1. `POST /api/{type}/requests`: submit a request
- Auth required. Body: the same fields the web form sends to `submit{CarRental|Logistics|Security}Request(formData)`, as JSON. Validate with zod against the table's constraints:
  - **car rental:** `trip_type ∈ {self_drive, chauffeur}` (required), `vehicle_type ∈ {sedan, suv, minivan, bus, luxury, pickup, coaster}` (optional), `pickup_state` (required), `pickup_address?`, `destination_state?`, `destination_address?`, `pickup_date` (required, `YYYY-MM-DD`, not in the past in Lagos time), `pickup_time?` (`HH:MM`), `return_date?` (≥ `pickup_date`), `number_of_passengers` (int 1–60), `purpose?`, `additional_notes?` (≤ 1000 chars), `pricing_model ∈ {full_day, half_day, hourly, per_km, multi_day, fixed}` (optional), `duration_value?` (number > 0), `is_urgent` (boolean, default false), `full_name`, `email`, `phone`, `trip_service_id?` (uuid; the action validates ownership).
  - **logistics / security:** mirror their actions' `formData` reads and the CHECK constraints in the baseline migration (`20261004121044_baseline_from_prod.sql`, `logistics_requests` ~4487, `security_requests` ~4944).
- Calls the submit action. → **201** `{ request }` (the inserted row).
- The action already returns `{success:false, error}` for no user; the route returns 401 before calling it.

### 2. `GET /api/{type}/requests?page=1&pageSize=10`: my requests
- Auth required. Calls `getMyCarRentalRequests(user.id, page, pageSize)` (logistics/security: their list actions with the caller's id). `pageSize` max 50.
- → **200** `{ requests: [...], count, page, pageSize }`. Each car-rental row already embeds `selected_vendor` and `selected_offer` (with `vehicle` and `driver`); keep that select.
- Add `offer_count` per request (pending offers) so the app can show "3 quotes" without N calls. One extra grouped query over `vendor_offers` for the page's ids is fine.

### 3. `GET /api/{type}/requests/{id}`: one request with offers (exists)
- Keep as is. Two changes: add `code` to its errors, and `Cache-Control: no-store`.
- Check that each embedded offer carries what a customer compares: `amount`, `message`, `pricing_model`, `breakdown`, the vendor's `business_name` and rating (avg + count, if the reviews table makes it cheap), and for car rental `vehicle {make, model, year, seats, vehicle_type, image_urls, is_verified}` and `driver {full_name, years_experience, photo_url, is_verified}`. Never include vendor or driver phone numbers before the request is `paid`.

### 4. `POST /api/{type}/requests/{id}/select-offer`: choose a quote
- Auth required. Body `{ offerId: uuid }`. Calls `select{CarRental|Logistics|Security}Offer(id, offerId)`.
- **Fix a race while here:** the action reads `status === "open"` and then updates without a condition. Make the status change compare-and-set (`.update(...).eq("id", id).eq("status", "open").select()` and treat zero rows as `request_not_open`), and the offer acceptance likewise on `status = "pending"`. Two quick taps (or web + app) must never accept two offers.
- → **200** `{ request, offer }`; 409 `request_not_open` / `offer_unavailable`; 404; 403.
- Payment stays as today: the app then calls `POST /api/payment/initialize` with `requestType: "car_rental"`.

### 5. `POST /api/{type}/requests/{id}/cancel`
- Auth required. Body `{ reason?: string ≤ 500 }`. Calls `cancel{…}Request(id, reason)`.
- → **200** `{ request, refund: "none" | "pending" }` (pending when it was `paid`/`in_progress`); 409 `not_cancellable`; 403; 404.

### 6. `PATCH /api/{type}/requests/{id}`: edit an open request with no offers
- Auth required. Body: only the action's editable fields (car rental: `pickup_date, pickup_time, return_date, number_of_passengers, purpose, additional_notes`). Calls `update{…}Request`.
- → **200** `{ request }`; 409 `not_editable`.

### 7. `POST /api/{type}/requests/{id}/confirm-complete`
- Auth required. Calls `confirmJobComplete(id, requestType)` from `app/actions/marketplace.js` (releases the payout; keep its checks).
- → **200** `{ request }`; 409 `not_completable`; 403; 404.

### 8. `POST /api/{type}/requests/{id}/review`
- Auth required. Body `{ rating: int 1–5, comment?: string ≤ 1000 }`. Calls `submit{…}Review`.
- → **201** `{ review }`; 409 `already_reviewed`; 409 `not_completable` if the job isn't completed.

### 9. `GET /api/{type}/price-estimate`: the guide price on the form
- No auth. Query mirrors `getEstimated{…}PriceRange` (car: `state`, `vehicleType`, `pricingModel`). → **200** `{ min, max, currency: "NGN" } | { min: null, max: null }`. `public` tier, `Cache-Control: public, s-maxage=300`.

### Not in this PR
- Messages and the trip planner (`app/actions/trips.js`): later, after all three categories ship in the app.
- `GET /api/payment/status/{ref}` returns `request: null` for `car_rental` (it fills logistics and security only). **Please include the car-rental case** in this PR if it's a small change; the app needs it to show the right state after paying.

## Tests (node test runner, `test/**/*.test.mjs`, existing helpers)

For car rental at minimum, then the same per type:
- Each route returns 401 `unauthorized` without a user, and never reads a user id from the client.
- Submit: 400 `bad_request` with `issues` for a bad `trip_type`, a past `pickup_date`, `return_date` before `pickup_date`; 201 on a valid body and the action is called once.
- Select-offer: 409 `request_not_open` when not open; 409 `offer_unavailable` for another request's offer; **two concurrent selects accept exactly one offer**.
- Cancel: 409 `not_cancellable` for `completed`; `refund: "pending"` from `paid`.
- List: only the caller's requests; `offer_count` correct; `pageSize` capped.
- Offers in the detail route carry no vendor or driver phone before `paid`.

## Done when

- The routes above exist for all three types (car rental first if splitting commits), with tests passing, `npm run lint` clean.
- The PR description lists each route with its codes. The mobile repo records them in `docs/BACKEND_STATUS.md` §7 (mobile does that, not this PR).
