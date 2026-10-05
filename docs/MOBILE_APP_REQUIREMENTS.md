# Bookhushly Mobile App — Requirements & Backend Handoff

**Status:** Draft v2 · 2026-10-02 · all ten open decisions resolved (§13)
**Audience:** the team (or Claude session) building the mobile app in a **separate repository**. You will not have this repo checked out, so this file carries every fact the mobile build depends on. Where something was *not verified*, it says so.
**Source of truth for the backend:** the web repo `bookhushly/BookHushly` (Next.js 16 + Supabase). Code paths below are relative to that repo.

---

## 0. How to read this document

| Marker | Meaning |
|---|---|
| **Verified** | Read directly from code or the live DB on 2026-10-02. |
| **Not verified** | Inferred or not inspected. Check before relying on it. |
| **BACKEND-REQ-n** | A change the *web repo* must make before or alongside the mobile build. Collected in §6. |
| **FR-x.y / NFR-x.y** | Functional / non-functional requirement IDs, used for traceability in tests and tickets. |
| **DECISION-n** | An open product or technical decision that blocks or shapes work. Collected in §13. |

---

## 1. Product summary

Bookhushly is a Nigerian marketplace and booking platform. Customers discover and book hotels, serviced apartments and events; other verticals (car rental, logistics, security) are request-for-quote marketplaces. Payments run through Paystack (cards, NGN) and NOWPayments (crypto).

### 1.1 What we are building

**One mobile app (Expo / React Native, iOS + Android)** serving three kinds of user, chosen automatically at sign-in:

| Mode | Who | What they do |
|---|---|---|
| **Customer** | Anyone with an account | Discover, book, pay, hold tickets, manage bookings |
| **Gate staff** | People hired to admit guests to an event | Scan event tickets, **including offline** |
| **Receptionist** | Hotel front-desk staff | Check guests in/out (with **camera QR scan**), manage room status |

### 1.2 Explicitly out of scope for v1

- **Vendor** console (listings, KYC, wallet, payouts, analytics) — stays on web.
- **Admin** console — stays on web.
- **Support inbox** — stays on web.
- **Customer wallet payments** — the backend returns HTTP 410 on purpose (`app/api/wallet/pay/route.js`). Do not build UI for it. v1 pays by **Paystack and crypto (NOWPayments)** (DECISION-4); wallet deposit/top-up is not in v1.
- **RFQ verticals for customers** (car rental, logistics, security) — **later phase** (DECISION-3: v1 customer scope is hotels, apartments and events only). They are structurally different from listing-and-booking and should not shape v1 architecture beyond leaving room for them.
- **Vendor scanner-roster management** (creating gate-staff accounts) — vendors do this on web (`lib/eventscanners.js`). Mobile only *consumes* those accounts.

### 1.3 Brand and design direction (owner-settled)

- **Light UI only.** No dark mode, no dark hero/sections.
- **Primary** violet-600 `#7C3AED`; ink `#1A0D4D`; tint backgrounds white / `#F8F7FB` / violet wash.
- **Type:** Radio-Canada (UI) + Source Serif 4 (display accents). Both OFL-licensed, chosen because they carry the **₦ sign, Yoruba/Igbo tone marks (ẹ ọ ṣ ị ụ) and tabular numerals**. The owner does **not** want "typical AI" fonts (Inter, Manrope, Space Grotesk, DM Sans, Plus Jakarta, Poppins, Playfair, Instrument Serif, Bricolage, Fraunces).
- **Type scale:** 12 → 80 px, nothing below 12 px, sentence-case labels (no uppercase letter-spaced eyebrows), semibold headings.
- **Avoid:** centered-everything heroes, gradient/glow grounds, fake stats, stock imagery posing as inventory, install/review prompts on launch.
- Verify visual decisions against Mobbin references before settling them.

---

## 2. Personas and how the app decides which mode to show

### 2.1 Roles in the backend (Verified)

`users.role` is one of `customer`, `vendor`, `admin`, `receptionist`, `support`. Two staff capabilities are **not** global roles:

| Capability | Where it lives | Notes |
|---|---|---|
| **Gate staff** | `event_scanners` (per event) + `vendor_scanners` (vendor's roster) | `users.role` stays `customer` **on purpose** — the role is scoped per event so the same person can still be a customer. Both rows must have `is_active = true`. |
| **Receptionist** | `users.role = 'receptionist'` + `hotel_staff` row (`hotel_id`, `role`) | Scoped to one hotel. |
| **Vendor owner** | `vendors.user_id` | Can also scan their own events (`admit_ticket` allows owner OR scanner). Vendors are out of scope for v1 mobile, but a vendor who signs in must get a sane experience (§FR-1.6). |

### 2.2 Mode resolution at sign-in (FR-1.4)

Resolve in this order after authentication, using data the user can read under RLS:

1. `users.role = 'receptionist'` **and** a `hotel_staff` row exists → **Receptionist mode**.
2. Has at least one active `event_scanners` row → **Gate mode** (the web app redirects these users to `/scan` in `app/actions/auth.js`).
3. Otherwise → **Customer mode**.

A user can qualify for more than one (a gate-staff account is also a customer). Provide a visible **mode switcher** in that case, and remember the last choice per device. Receptionist and gate staff are separate login populations in practice, so this is an edge case, not the main path.

---

## 3. System context (Verified unless noted)

### 3.1 Backend stack

- **Supabase project** `wdhhbgxdpjjuqjideqws` (eu-north-1): Postgres, Auth, Storage, Realtime. This is a **live production project** with test-mode payment keys; it was wiped to a single admin row for go-live, so empty tables are expected.
- **Next.js 16 App Router** hosts both the web app and the HTTP API (`app/api/**/route.js`). Much of the web app's logic is **server actions** (`app/actions/*.js`), which a mobile client **cannot call**. Every flow mobile needs must be reachable as an HTTP route or a direct Supabase call under RLS.
- **Upstash Redis** backs rate limiting (`proxy.js`) and a 60 s listings cache.
- **Paystack** (test keys currently), **NOWPayments** (crypto), **Cloudinary** (uploads), **Web Push** (VAPID).

### 3.2 Authentication today — the critical gap

- Supabase Auth, email + password. Sessions are **cookies** (`@supabase/ssr`, `lib/supabase/server.js`), not httpOnly.
- Routes authenticate with `getSessionUserId()` / `getAuthUser()` (`lib/auth/session.js`), which verify the access-token JWT **locally** against cached JWKS — no network call. `createClient()` builds a **cookie-backed** server client.
- **There is no `Authorization: Bearer` path.** A native app has no cookie jar in the browser sense. → **BACKEND-REQ-1** (§6).
- Access-token TTL is **1 hour** (Supabase default); a documented follow-up is to raise it. Mobile must refresh silently.
- `getVerifiedUser()` (network-checked, revocation-safe) exists but is used in almost no routes. Money-movement routes use the local check. Known audit item (§1.8 of `docs/PRELAUNCH_AUDIT.md`).
- Rate limits (`lib/rate-limit/tiers.js`), per sliding 60 s window:

| Tier | Limit | Keyed by | Notes |
|---|---|---|---|
| `auth` | 5 | IP | `/login`, `/register`, `/forgot-password`, `/reset-password` POSTs. Fails **closed**. |
| `payment` | 30 | IP | Fails **closed** on Redis outage. |
| `user` | 30 | IP | Authenticated user actions. |
| `public` | 60 | IP | Reads. |
| `gate` | 1200 | **user** | Scanner routes. |
| `ticket` | 20 | **user** | Rotating-code refresh. |
| `resend` | 3 | IP | Ticket resend email. |
| `ai` | 10 | IP | Not used by v1. |

  Mobile carriers NAT many users behind one IP; IP-keyed limits (`auth`, `payment`, `user`, `public`) can throttle real users. Treat 429 as a normal, recoverable condition (§NFR-2.4). The `gate` and `ticket` tiers are user-keyed because venues share one IP.

### 3.3 Data model (relevant tables; Verified from live DB)

```
users(id, email, name, role, phone, state, address, reg_state, reg_city, reg_country, …)
hotels / hotel_room_types / hotel_rooms / hotel_room_rates / hotel_bookings / hotel_staff
serviced_apartments / apartment_bookings / apartment_availability*
listings            (events live here: category='events', plus vendor_id, event_date, location,
                     remaining_tickets, require_dynamic_ticket)
event_bookings      (id, listing_id, customer_id NULLABLE, contact_email, contact_phone,
                     ticket_details jsonb {packageName: qty}, total_amount, status, payment_status,
                     payment_reference, checked_in, checked_in_at, seat_assignments jsonb, …)
event_tickets       (id, booking_id, listing_id, ticket_type, ticket_index, checked_in_at, scanned_by)
event_scanners      (id, listing_id, user_id, created_by, is_active)
vendor_scanners     (id, vendor_id, user_id, created_by, is_active)
hotel_staff         (id, hotel_id, user_id, role)
notifications       (id, user_id, type, title, message, data jsonb, link, read, created_at)
push_subscriptions  (id, user_id, endpoint, p256dh, auth)   -- Web Push shaped
saved_listings, reviews, trips, trip_services, promo_codes, payments, wallets, wallet_transactions …
```

`hotel_bookings` key fields: `guest_name/email/phone`, `check_in_date`, `check_out_date`, `booking_status` (`confirmed`, `checked_in`, `cancelled`, `completed`…), `payment_status` (paid values `completed`/`paid`, plus `pay_at_hotel`), `checked_in`, `checked_in_at`, `checked_out_at`, **`check_in_code`** (8 chars), `room_id`.

### 3.4 Guest checkout is the norm (important)

Event and hotel bookings can be created **without an account**: `event_bookings.customer_id` and `hotel_bookings.customer_id` are nullable, and `app/api/bookings/event/create/route.js` documents that "every booking on this platform is a guest checkout". Consequences for mobile:

- A signed-in customer's bookings are only those with `customer_id = their id`. Guest bookings made earlier with the same email are **not** linked (Not verified whether any linking exists; see DECISION-6).
- **Rotating (anti-screenshot) event ticket codes are only available to the ticket holder with `customer_id` set** (`app/api/tickets/[ticketId]/code/route.js` returns 403 otherwise). Guest bookings fall back to the static printed ticket. The app must support **both** ticket display modes (§FR-2.7).

---

## 4. Gate staff mode — how the web flow works today (Verified)

The web gate app is `app/scan/page.jsx` + `app/scan/client.jsx`. It is kept deliberately outside the vendor dashboard because these accounts "grant nothing beyond admitting tickets for that event".

### 4.1 Event discovery

`getMyScannableEvents()` (`lib/eventscanners.js`) returns events the user is assigned to; the page also adds events the user owns as a vendor. Empty result → "No events assigned" screen with sign-out.

### 4.2 Admit a ticket — `POST /api/events/{listingId}/scan`

Request: `{ "ticket_id": "<scanned payload>" }` where the payload is one of:

| Shape | Example | Origin |
|---|---|---|
| Rotating code | `BH1.<32hex>.<step36>.<22-char sig>` | Attendee's live ticket |
| Printed ticket URL | `https://…/t/<uuid>` | PDF ticket QR |
| Bare UUID | `<uuid>` | Manual entry |

The client normalises (`parseTicketCode`): `BH1.…` passes through untouched, otherwise the first UUID found is extracted; anything else is rejected client-side.

Server flow: auth (`getSessionUserId`) → if rotating, `verifyTicketToken` (HMAC-SHA256 over `ticketId:step`, 30 s steps, ±1 step tolerance → each code valid ~30–90 s) → UUID shape check → **`admit_ticket(p_listing_id, p_ticket_id, p_user_id, p_is_rotating)`** RPC (service-role only; execute revoked from `anon`/`authenticated`).

`admit_ticket` is **atomic and first-writer-wins**: `UPDATE event_tickets SET checked_in_at = now(), scanned_by = … WHERE id = … AND checked_in_at IS NULL`. Losing a race returns `already_checked_in` with who/when. It also updates `event_bookings.checked_in` when every sibling ticket is in.

Success `200`:
```json
{ "ok": true,
  "ticket":  { "id", "ticket_type", "ticket_index", "checked_in_at", "seat" },
  "booking": { "id", "contact_email", "contact_phone", "total_tickets",
               "checked_in_count", "tickets": [ { "id","ticket_type","ticket_index","checked_in_at" } ] } }
```

Refusals (body `{ error, code, … }`):

| `code` | HTTP | Gate message | Retryable? |
|---|---|---|---|
| `forbidden` | 403 | You aren't assigned to this event | No |
| `not_found` | 404 | Ticket not found | No |
| `booking_qr` | 409 | Old ticket format — look this booking up by hand | No |
| `wrong_event` | 409 | This ticket is for a different event | No |
| `not_confirmed` | 409 | Booking is not confirmed | No |
| `static_not_allowed` | 409 | This event requires a live ticket code, not a printed QR | Attendee must show live ticket |
| `already_checked_in` | 409 | Ticket already checked in (`checked_in_at`, `scanned_by`, `ticket`, `ticket_count` included) | No |
| `expired_code` | 409 | Code expired — ask them to refresh | Yes (attendee refreshes) |
| `invalid_code` | 409/400 | Invalid ticket code / Not a Bookhushly ticket | No |
| `lookup_failed` | 503 | Couldn't read the ticket — try again | **Yes** |
| 401 | | Unauthorized | Re-auth |
| 429 | | rate limited | **Yes** — and the web UI wrongly renders it as "Do not admit"; mobile must not (§FR-3.9) |

Responses carry a `Server-Timing` header (`auth`, `rpc`, `total`).

### 4.3 Door totals — `GET /api/events/{listingId}/scan/summary`

`{ admitted, total, recent: [ {id, ticket_type, checked_in_at, scanned_by_me, …} ] }` (last 50, all scanners). `Cache-Control: no-store`. Backed by the `scan_summary` RPC with the same authorisation as `admit_ticket`.

### 4.4 The scan queue (`lib/scan/queue.js`) — port this logic

Pure JS, no React/DOM, unit-tested (`test/scan-queue.test.mjs`). Behaviour to preserve:

- Scans **queue instead of drop**; concurrency 3; up to 2 retries with 400 ms × attempt backoff.
- De-dupes on the code itself.
- **Terminal results** (`ok`, `used`) are remembered (cap 5000, oldest-first eviction) and **replayed instantly** if the same code is presented again on this device. Fixable refusals (expired code, static-on-live-only) are *not* terminal, because the attendee will present again.
- Outcome hold times: admitted 1.6 s, already-used 3.2 s, refresh 3.2 s, **refusal holds until staff dismiss** (someone must handle that person).
- Audio/haptic feedback per outcome (`app/scan/feedback.js`).
- Scanning continues while a request is in flight (the camera must keep accepting the next person).

### 4.5 What does **not** exist today (gaps → requirements)

- **No offline support at all.** The queue is in memory, retries last ~1.2 s, there is no cached attendee list, no persistence. Refresh loses state. → §8.
- Undo is owner-only on purpose (`POST /api/events/[id]/checkin`): **gate staff must never be able to un-admit.** Do not expose undo in mobile gate mode.
- Door counts were once client-only state and are now server-derived; keep it that way.

---

## 5. Receptionist mode — how the web flow works today (Verified)

Web: `app/receptionist/layout.jsx` (role gate) + `app/receptionist/dashboard/page.jsx` with tabs `CheckInTab`, `CurrentGuestsTab`, `RoomStatusTab` (`components/shared/dashboard/receptionist/*`).

### 5.1 Context load

Direct Supabase client query (RLS): `hotel_staff` → `hotels(id, name, city, state, address, image_urls)` for `user_id = me`, `.single()`. No row → "No Hotel Assigned" screen (PGRST116 is the normal "no assignment" signal). Stats: room counts by `status` (`occupied|available|dirty|…`) and **count of today's expected arrivals** (`check_in_date = today AND booking_status = 'confirmed' AND checked_in = false`). Realtime subscriptions on `hotel_rooms` and `hotel_bookings` (filtered by `hotel_id`) refresh stats.

### 5.2 RLS that applies to receptionists (Verified live)

- `hotel_bookings` SELECT: customer themself, hotel's vendor owner, **any `hotel_staff` row for that hotel**, admin.
- `hotel_rooms` SELECT/UPDATE: vendor owner or `hotel_staff` for that hotel.
- `hotel_staff` SELECT own row (`user_id = auth.uid()`).
- `hotel_bookings` has **no authenticated UPDATE policy** — only `service_role`. All state changes go through the API routes below.

### 5.3 Check-in — `POST /api/bookings/hotel/checkin`

Body: `{ "code": "XXXXXXXX" }` **or** `{ "booking_id": "<uuid>" }`. Allowed roles: `vendor`, `admin`, `receptionist`. Receptionist must have a `hotel_staff` row **for that booking's hotel** (else 403). Refusals: 404 not found; 409 `Guest is already checked in`; 400 cancelled; 400 payment not complete (allowed: paid, or `pay_at_hotel`). On success: sets `checked_in`, `checked_in_at`, `booking_status = 'checked_in'`, room → `occupied`, notifies the guest (best effort). Returns `warning` when the guest is checking in **before** their booked date (non-blocking; front desk decides) and `booking {id, guest_name, check_in_date, check_out_date, hotel_name}`.

`GET /api/bookings/hotel/checkin?code=XXXXXXXX` previews a booking **without** checking in (the web UI uses it to confirm before committing). *(Not verified in detail — only the doc comment and handler start were read.)*

### 5.4 Check-out — `POST /api/bookings/hotel/checkout`

Body `{ "booking_id" }`. Receptionist assigned to the hotel, owning vendor, or admin. Marks the booking completed; has an **early-checkout warning**. *(Not verified in detail beyond the header comment.)*

### 5.5 Room status — `PATCH /api/hotel/rooms/{roomId}/status`

Body `{ "status": "available" | "dirty" | "under_maintenance" | "out_of_service" | "reserved" }`. **409 if the room is `occupied`** (cannot change while a guest is in). Vendors are ownership-checked; receptionist scoping beyond the role check was **not verified** for this route (BACKEND-REQ-6).

### 5.6 What does **not** exist today (gaps → requirements)

- **No camera scan.** The guest sees a QR containing the 8-char `check_in_code` ("scan at the front desk") but staff only search by name/phone/room/code and type it. The mobile app adds camera scanning (FR-4.x). The QR payload is the **raw 8-char code, nothing else** (`react-qr-code value={check_in_code}`), so there is no URL/prefix to parse and no signature.
- **Check-in is not atomic** — the route reads the booking, then updates it. Two staff scanning the same guest can both pass the `checked_in` check. (BACKEND-REQ-4.)
- No offline mode for the front desk (see DECISION-2: recommend online-only for receptionists).

---

## 6. Backend work required in the web repo

These must be done by the web side. Mobile cannot work around them.

| ID | Change | Why | Priority |
|---|---|---|---|
| **BACKEND-REQ-1** | **DONE — merged in PR #157.** **Bearer-token auth.** Make `getSessionUserId`/`getAuthUser`/`createClient` (and therefore every route in §7) accept `Authorization: Bearer <supabase access_token>` when no cookie session is present, verifying with the same JWKS path. Keep cookie auth working for web. | Native apps have no cookies; today every authenticated route returns 401. | **P0** |
| **BACKEND-REQ-2** | **IMPLEMENTED in `feat/offline-scan-backend` (migration applied to the live DB).** **Batch/offline admit endpoint** (§8.5): `POST /api/events/{id}/scan/batch` accepting an array of `{ ticket_id, scanned_at, device_id, client_seq }`, returning a per-item result. Must be idempotent on `(device_id, client_seq)` and record the **client scan time** (`admit_ticket` currently stamps `now()` = sync time). | Offline scans must keep their real timestamps and be safely replayable. | **P0** |
| **BACKEND-REQ-3** | **IMPLEMENTED in `feat/offline-scan-backend`.** **Event roster endpoint** `GET /api/events/{id}/scan/roster` (cursor-paginated, `since` support; **no ETag was implemented**): all `event_tickets` for the event with `ticket_id, ticket_type, ticket_index, booking_id, checked_in_at, holder display name, **masked** phone (e.g. `0803••••210`), seat, booking status`. **No email, no full phone** unless the vendor opts in per event (DECISION-8). Same authorisation as `scan_summary`. Include `require_dynamic_ticket`, the event's **signing public key set** (BACKEND-REQ-9) and, if the override is enabled, the PIN verifier (BACKEND-REQ-12). | Foundation of offline mode. Contains attendee PII → see NFR-3.x. | **P0** |
| **BACKEND-REQ-4** | **IMPLEMENTED in `fix/atomic-hotel-checkin` (migration applied to the live DB); check-out made atomic too; every refusal now carries a stable `code` — see `docs/superpowers/specs/2026-10-03-atomic-hotel-checkin-design.md`.** Make hotel **check-in atomic** (single `UPDATE … WHERE checked_in = false RETURNING`, or an RPC like `admit_ticket`) and return a stable machine code (`already_checked_in`, `not_paid`, `cancelled`, `forbidden`, …) alongside the message. | Two receptionists scanning the same guest. Concurrency tester should cover it. | P1 |
| **BACKEND-REQ-5** | **Push for native.** `push_subscriptions` stores Web Push (`endpoint`, `p256dh`, `auth`). Add Expo/FCM/APNs token registration (new table or `kind`/`token` columns), `POST/DELETE /api/push/devices`, and make `lib/notifications` fan out to native tokens. See `docs/PUSH_NOTIFICATIONS.md` for the web flow. | Web Push does not work in a native app. | **P0** for the notifications feature |
| **BACKEND-REQ-6** | **DONE in `fix/atomic-hotel-checkin`:** room-status already scoped receptionists to their own hotel (its occupied guard now sits in the update itself), checkout is scoped by the new database function, and the check-in **preview (GET) had no hotel scoping, which is fixed**. Audit receptionist scoping on `PATCH /api/hotel/rooms/{roomId}/status` (confirm a receptionist can only change rooms of **their** hotel, as check-in does) and on checkout. | Public mobile surface raises the stakes of missing guards (audit §1.4–§1.6). | P1 |
| **BACKEND-REQ-7** | **Customer-facing HTTP APIs for flows that are server-action-only today**: hotel booking (`book_hotel_room` RPC via `app/actions/hotels.js`), apartment booking (`app/actions/apartment-booking.js`), customer KYC, trips, messages, reviews submission. Either expose routes or confirm direct RLS-safe Supabase access. Inventory the gaps with `security-auditor` before the customer phase. | Mobile cannot invoke server actions. | **P0** for customer booking |
| **BACKEND-REQ-8** | **Deep links / universal links** for payment return and tickets: Paystack `callback_url` currently points at web pages (`/payment/callback`, `/wallet/deposit/callback`). Provide an app-scheme/universal-link return (or an in-app WebView strategy, DECISION-5) and `apple-app-site-association` + `assetlinks.json`. | Returning from Paystack checkout into the app. | P0 for payments |
| **BACKEND-REQ-9** | **IMPLEMENTED in `feat/signed-ticket-codes` — behind `TICKET_TOKEN_FORMAT`, off by default; keys must be provisioned and the flag flipped by the owner.** **Asymmetric rotating ticket codes (DECISION-1: option C).** Replace the HMAC `BH1` token with a public-key-signed `BH2` token (Ed25519 recommended). Server holds the private key (env/secret store, never shipped); a **public key set with `kid`** is served to authorised scanners via the roster endpoint and embedded in the build as a fallback. Add key rotation (multiple valid `kid`s). Keep `BH1` accepted **online only** for a transition window, then retire it. Update `lib/ticket-tokens.js`, `app/api/tickets/[ticketId]/code`, the scan route, and the web ticket page/scanner. | Lets a phone verify rotating codes fully offline without holding a secret. | **P0 for the offline phase** |
| **BACKEND-REQ-10** | Raise Supabase access-token TTL / confirm refresh-token rotation settings suit mobile. | Existing follow-up from the notifications incident (PR #130). | P2 |
| **BACKEND-REQ-11** | **Claim-by-verified-email (DECISION-6).** After the user has a verified email, offer a one-time claim that sets `customer_id` on `event_bookings`/`hotel_bookings`/`apartment_bookings` whose contact email matches (case-insensitive). Must be server-side, authenticated, idempotent, never claim a booking already owned by another account, and be audit-logged. Never auto-link without verification. | New app users otherwise see none of their past bookings, and guest tickets can't get rotating codes. | P1 |
| **BACKEND-REQ-12** | **IMPLEMENTED in `feat/scan-override-pin` (migration applied to the live DB).** **Supervisor override PIN (DECISION-7).** Per-event PIN set by the vendor on web (vendor UI + column on `listings` or a new table). Store only a salted slow hash; deliver a verifier (salt, cost, hash) to authorised scanners via the roster endpoint. Offline overrides sync as exceptions through the batch endpoint with the reason and approving device. Include attempt lockout guidance. | Lets staff admit a late purchaser offline, accountably. | P1 |
| **BACKEND-REQ-13** | **NOWPayments for a native client (DECISION-4).** Confirm `/api/payment/initialize` (`provider: "crypto"`) returns a hosted invoice/payment URL usable in the in-app browser, define the return/deep-link, and expose reliable terminal statuses (waiting, confirming, partially paid, expired, failed, finished) via `/api/payment/status/{reference}`. | Crypto is in v1 scope; its flow is longer and has more states than card. | P1 |

---

## 7. API surface the mobile app will call

All paths are relative to the production base URL (**not recorded here — obtain from the web team**; the env var is `NEXT_PUBLIC_BASE_URL`). All JSON. **All authenticated routes require BACKEND-REQ-1.**

### 7.1 Auth (Not verified — web uses Next server actions in `app/actions/auth.js`)

Mobile should use **`supabase-js` directly** against the Supabase project (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `refreshSession`) with the public project URL and **anon key** (obtain from the web team; the anon key is public by design). Do **not** ship the service-role key anywhere in the app. Registration also inserts a `users` row and has role-specific copy; confirm what `registerUser`/signup does server-side (profile row creation, welcome email, admin notification) before reimplementing it — it may need a route.

### 7.2 Customer

| Purpose | Endpoint / mechanism | Notes |
|---|---|---|
| Browse listings | `GET /api/listings` (public, Upstash-cached 60 s, page size 20, per-category cache version) | Query params: read `app/api/listings/route.js` and `lib/listings/cache-key.js`. |
| Listing detail | `GET /api/listings/{id}` | |
| Nearby | `GET /api/nearby-listings` | |
| Natural-language search | `POST /api/search/parse-query` | `ai` tier (10/min). Optional. |
| Hotel availability | `GET /api/hotels/room-types/{id}/availability`, `…/booked-dates` | |
| Apartment calendar | `GET /api/vendor/apartments/ical` (vendor-oriented), blocked dates | Confirm what customers use. |
| Booking lock | `POST /api/listings/lock`, `/api/booking-locks/cleanup` | Short-lived holds while paying. Read before building checkout. |
| Create event booking | `POST /api/bookings/event/create` → pending booking; then pay | Body: `listing_id, contact_email, contact_phone, ticket_details{pkg:qty}, custom_answers, promo_code_id`. Max 20 tickets. |
| Free event booking | `POST /api/bookings/event/free` | |
| Hotel booking | server action `book_hotel_room` RPC | **BACKEND-REQ-7** |
| Apartment booking | `POST /api/bookings/apartment`, server action | **BACKEND-REQ-7** |
| Promo | `POST /api/promo/validate` | |
| Service charge | `GET /api/service-charges` | |
| Initialise payment | `POST /api/payment/initialize` | Body `{requestId, requestType: hotel\|apartment\|event\|…, amount, currency="NGN", email, provider: paystack\|crypto, payCurrency?, metadata}`. **Server must recompute price** — see NFR-3.6. `payment` tier. |
| Verify payment | `POST /api/payment/verify` `{reference, provider}` | Idempotent; webhook is the safety net (`/api/webhooks/paystack`, `/api/webhooks/nowpayments`). |
| Payment status | `GET /api/payment/status/{reference}`, `POST /api/payment/check-status` | Poll this after returning from checkout. |
| My bookings | direct RLS reads on `event_bookings`/`hotel_bookings`/`apartment_bookings` or route | Event bookings are **deny-by-default** for authenticated reads in places (see comment in `payment/initialize`); confirm access path. |
| Booking detail | `GET /api/bookings/event/{id}`, `/hotel/{id}`, `/apartment/{id}` | |
| Cancel | `POST /api/bookings/{event\|hotel\|apartment}/{id}/cancel` | |
| Change request / dispute / messages | `POST /api/bookings/apartment/{id}/change-request`, `/dispute`, `/messages` | |
| Refund | `POST /api/refunds/request` | |
| Transfer event ticket | `POST /api/bookings/event/{id}/transfer` `{new_email}` | Owner only; confirmed+paid; event not past. Moves to the new user if the email matches an account, else becomes a guest transfer. |
| Live ticket code | `GET /api/tickets/{ticketId}/code` | Holder only (needs `customer_id`); `ticket` tier 20/min; refresh ~every 28 s. Response includes `token` + `expiresAt`; read the route's tail for the exact shape. |
| Ticket PDF / preview / resend | `/api/ticket-download`, `/api/ticket-preview`, `POST /api/tickets/resend` | `resend` tier 3/min/IP. |
| Calendar | `GET /api/calendar/ics` | |
| Saved listings | `/api/saved-listings` | |
| Reviews | `/api/reviews/{listingId}`, `/api/reviews/awaiting` | |
| Follow organizer | `/api/organizers/{vendorId}/follow` | |
| Waitlist | `/api/events/{id}/waitlist` | |
| Notifications | direct RLS on `notifications` (select/update/delete own) | Use `lib/notifications/write.js` semantics: **a stale session makes writes silently return 204 with 0 rows** — the client must verify an update affected a row, refresh the session and retry (PR #130). |
| Profile / KYC | `/api/customer/kyc`, `users` row | |
| Wallet | `/api/wallet*` (deposit, balance, transactions) | **Pay is 410.** Display-only at most; deposit is optional (DECISION-4). |
| Support chat | `POST /api/support/chat` | Optional v1. |

### 7.3 Gate staff

**Offline endpoints are implemented** — exact contracts, response codes and decisions are in `docs/superpowers/specs/2026-10-03-offline-scan-backend-design.md`: `POST /api/events/{id}/scan/batch` (idempotent per event on `device_id` + `client_seq`, max 200 items, per-item results, `by_me` distinguishes a harmless retry from a two-door conflict) and `GET /api/events/{id}/scan/roster` (keyset-paged, `no-store`; first page includes the BH2 public keys). Guest bookings usually have **no name**, so roster lookup is mostly by the last digits of the phone.

`GET` events assigned (needs a route or RLS read of `event_scanners` joined to `listings` — web uses a server helper; **BACKEND-REQ-7-style gap**), `POST /api/events/{id}/scan`, `GET /api/events/{id}/scan/summary`, plus new §6 BACKEND-REQ-2/3.

### 7.4 Receptionist

`hotel_staff` read (RLS), `hotel_bookings` / `hotel_rooms` reads (RLS) + Realtime, `GET|POST /api/bookings/hotel/checkin`, `POST /api/bookings/hotel/checkout`, `PATCH /api/hotel/rooms/{roomId}/status`.

---

## 8. Offline gate scanning — design requirements

### 8.1 Constraints that shape the design (Verified from `lib/ticket-tokens.js` and `admit_ticket`)

1. **Today** a rotating code is `BH1.<ticketId (32 hex, no dashes)>.<step base36>.<22-char HMAC>`: the ticket ID is readable, and the signature is HMAC-SHA256 with a **server-only secret** (`TICKET_TOKEN_SECRET`). A phone cannot verify that without holding the secret, and **the app must never contain it.**
2. **Decision (DECISION-1, option C):** replace it with a **public-key-signed `BH2` token** so a phone can verify rotating codes fully offline using only a public key. This is **BACKEND-REQ-9** and gates the offline phase (§12).
3. Static printed codes are just ticket UUIDs — fully checkable against a roster.
4. Events with `require_dynamic_ticket = true` reject static codes online (anti-screenshot) and **must reject them offline too.** A fresh screenshot forwarded within the validity window (~90 s) passes online and offline alike; that residual exposure is unchanged and acceptable.
5. Admission is **first-writer-wins per ticket** on the server (`checked_in_at IS NULL`). Two phones that both admit offline will conflict on sync (§8.5).
6. The server stamps `checked_in_at = now()` at sync time, not scan time (fix: BACKEND-REQ-2).

### 8.2 The `BH2` signed-code scheme (DECISION-1: option C) — requirements

**Implemented in the web repo** (branch `feat/signed-ticket-codes`; design in `docs/superpowers/specs/2026-10-02-signed-ticket-codes-design.md`). The mobile app must follow this exactly:

```
BH2.<kid>.<id>.<step>.<sig>

kid   1 char in practice [a-z0-9] (format allows up to 8) — selects the public key
id    22 chars base64url   the ticket UUID's 16 bytes (NOT the 32-hex form BH1 used)
step  base36               floor(epochSeconds / 30); valid if |nowStep − step| ≤ 1
sig   86 chars base64url   Ed25519 signature (64 bytes) over the UTF-8 message
                           "bh2:<kid>:<ticket uuid, lowercase, dashed>:<step>"
```

To decode `id`: base64url → exactly 16 bytes → format as a lowercase dashed UUID. Decoding is **strict**: reject any `id` or `sig` whose base64url is not the canonical encoding of its bytes (re-encode and compare), and reject lengths other than 22 and 86.

- **Algorithm:** Ed25519. Total token length is `121 + len(kid)` characters, which is 122 with a 1-character kid. That is exactly the byte capacity of a QR version 7 (45×45) symbol at error-correction level M; longer tokens step up to a denser symbol, so the web generates 1-character kids. ECDSA P-256 would be the same size; RSA is far too large.
- **Keys:** the private key stays on the server (env `TICKET_KEYS`; never shipped). Public keys are published at **`GET /api/ticket-keys`** (no auth, cacheable 1 minute): `{ alg: "Ed25519", format: 2, step_seconds: 30, keys: [{ kid, publicKey, signing }] }`, where `publicKey` is the **raw 32-byte key, base64url** (what `@noble/ed25519` takes). Embed the set as a fallback in the build and refresh it from this endpoint (and later the roster). An empty `keys` array with HTTP 200 means BH2 is not set up yet; a 503 means retry. Several kids can be valid at once so keys rotate without breaking tickets already on screens. The web rotates in two steps (publish the new public key, wait ≥ 10 minutes, then start signing with it), so a phone that meets an **unknown `kid` must refresh the key list once before refusing the code**.
- **Verification (device):** parse → choose key by `kid` → verify signature over the signing input with a vetted library (e.g. `@noble/ed25519`; do not hand-roll) → check step window against the **offset-corrected clock** (§8.6) → look the ticket up in the roster (§8.4). A bad signature is `invalid_code`, never "try again".
- **Issuing:** `GET /api/tickets/{ticketId}/code` keeps its contract (holder-only, `ticket` tier), but returns a `BH2` token. The customer app displays whatever token the server returns; it never signs anything.
- **Transition:** codes live only about 90 seconds, so cutover is quick. Issuance is switched by the server flag `TICKET_TOKEN_FORMAT` (`1` default, `2` for BH2); the server verifies both formats at all times. During the cutover the server accepts both formats **online**. **Offline, a `BH1` code cannot be verified**; the scanner must treat it as "cannot verify offline — look the ticket up in the roster / ask the attendee to refresh when online", never admit it on the strength of the ticket ID alone. Plan a minimum app version and a web ticket-page update so attendees stop receiving `BH1`; retire `BH1` afterwards.
- **Defence in depth:** online sync still re-runs full server-side verification and the owner/scanner authorisation check; signature checks on the device are an *additional* gate, not a replacement.
- **Replay:** a code remains reusable inside its ~90 s window (as today). The roster/outbox "already admitted" check is what prevents a second admission of the same ticket.

### 8.3 Roster sync

- **FR-3.4** Staff can **download the roster** for an event when online; the app stores it in a local encrypted database. Show: tickets, last-synced time, and size.
- **FR-3.5** Auto-refresh the roster in the background while online (delta by `since`, plus a periodic full refresh because `since` misses later cancellations/refunds). Warn when the roster is **stale** (> N minutes, configurable; default 15) and when offline with no roster at all.
- **FR-3.6** The roster must be downloadable **before** the venue (staff are told to sync on arrival on good Wi-Fi) and usable with airplane mode on from then on.
- Scale target: **tens of thousands of tickets per event**; roster sync must be paginated and resumable (NFR-1.5).

### 8.4 Offline decisioning (what the device may do on its own)

Outcome table when **offline**:

| Situation | Offline outcome |
|---|---|
| Ticket in roster, not in, **signature valid** and step in window | **Admit (offline)** — record locally, show an "offline" marker; re-verified on sync |
| `BH2` signature invalid / unknown `kid` | **Refuse** — "Invalid ticket code" (not retryable) |
| `BH1` code (HMAC, unverifiable offline) | **Do not admit on ID alone** — "Can't verify offline"; offer roster lookup or ask attendee to refresh when online |
| Static code on a `require_dynamic_ticket` event | **Refuse** — "Live ticket required" |
| Ticket in roster, `checked_in_at` already set in roster | **Already used** (show time + by whom from roster) |
| Ticket admitted earlier **on this device** (local log) | **Already used** (replay) |
| Ticket not in roster | **Do not admit — "Not in offline list"**; offer **supervisor override** (PIN + reason, FR-3.15), recorded as an exception |
| Ticket for a different event (roster lacks it) | Refuse; "wrong event / unknown" |
| Booking not confirmed in roster | Refuse |
| Expired code (step out of window) | "Refresh your ticket" |
| Booking-level (old format) QR | "Look this booking up by hand" — offer roster search |

- **FR-3.7** Manual **name / last-digits-of-phone lookup** in the roster as the fallback when a code won't scan (the roster holds name + masked phone only, DECISION-8), then admit by ticket from the list. Lookup-admissions of rotating-code events are flagged `mode = manual_lookup` and synced as exceptions.
- **FR-3.8** Show group context: remaining tickets on the same booking, like the online `booking.tickets` array.

### 8.5 Sync of offline admissions

- Every offline admission is appended to a **durable local outbox** (survives crash/reboot) with: `ticket_id`, `scanned_at` (device time + a server-clock offset estimate), `device_id`, monotonic `client_seq`, `mode` (`offline`, `offline_override`, or `manual_lookup`), `kid` used, `app_version`.
- Sync runs automatically when connectivity returns and manually via "Sync now", in order, in batches via **BACKEND-REQ-2**, with exponential backoff, and is **idempotent** (re-sending an item must not double-admit or double-count).
- Per-item results the UI must reconcile:

| Server result | Meaning | Staff-visible handling |
|---|---|---|
| `ok` | Recorded | Mark synced |
| `already_checked_in` (by someone else, earlier) | **Conflict**: two doors admitted the same ticket | List as **"Duplicate admissions"** with both times/people; no automatic undo (gate staff cannot undo) → surfaces to the vendor on web |
| `already_checked_in` (by this same device earlier) | Retry of an already-synced item | Silently mark synced |
| `forbidden` | Assignment revoked mid-event | Stop; alert; keep log for the organiser |
| `invalid_code` on re-verify | Server re-verification disagreed with the device (bad signature, revoked key, or tampered client) | **Flag as suspect** for organiser review; investigate the device |
| network/5xx | | Keep in outbox, retry |

- **FR-3.9** A visible **sync state** at all times: online/offline, pending count, last sync, errors. A scanner must never lose an admission silently.
- **FR-3.10** Closing the app, a crash, a dead battery or an OS update must not lose pending admissions (write-ahead to disk **before** showing the success state).
- **FR-3.11** On logout or "end of event", require the outbox to be empty (or explicitly exported/confirmed) before wiping local data.

### 8.6 Clock integrity

Time-step checks depend on the phone clock. A wrong clock makes valid codes look expired (or lets stale ones pass).

- On every successful online request, compute `offset = serverTime − deviceTime` from the HTTP `Date` header and persist it; use `deviceTime + offset` for offline step checks.
- If the device clock differs from the last known offset by more than ~2 minutes without a server contact, warn staff and **fall back to roster-only (static) decisions** or require supervisor confirmation.

### 8.7 Multi-device offline

Two phones on one door cannot see each other offline. The product must say so plainly (staff briefing, in-app note) and rely on §8.5 conflict reporting. Optional later: LAN/peer sync between scanner phones.

---

## 9. Functional requirements

Priorities: **M** must (launch), **S** should, **C** could (post-launch).

### 9.1 FR-1 Account, session, mode

| ID | Requirement | P |
|---|---|---|
| FR-1.1 | Sign in with email + password via Supabase Auth; show clear errors; respect the `auth` rate limit (5/min/IP) with a friendly "try again in a minute". | M |
| FR-1.2 | Register a customer account; email verification behaviour matches web (verify what Supabase confirmation settings require). | M |
| FR-1.3 | Forgot / reset password via email deep link back into the app (needs universal link, BACKEND-REQ-8). | M |
| FR-1.4 | Resolve mode per §2.2 after sign-in; mode switcher when more than one applies; remember last mode. | M |
| FR-1.5 | Persistent session in the OS secure store; silent token refresh; handle refresh failure by returning to sign-in without losing unsynced gate data. | M |
| FR-1.6 | A **vendor/admin/support** account signing in gets a clear "Use the web dashboard" screen (with link), not a broken app. Vendors who own an event may still use **Gate mode** for their own events (the backend allows owner-scan). | M |
| FR-1.7 | Biometric/PIN app lock (optional) — strongly recommended for shared gate phones. | S |
| FR-1.8 | Sign-out clears tokens and local PII (subject to FR-3.11). Delete-account flow, **required by App Store / Play policy** if account creation exists in-app (matches web capability — confirm). | M |
| FR-1.9 | On a shared device, show **whose session is active** (name/email) before scanning begins (the web gate app does this in its account sheet). | M |
| FR-1.10 | **Onboarding** (owner decision 2026-10-04: must-have for v1): first-launch introduction for the **customer** mode, skippable, shown once, Lottie-illustrated per `docs/MOTION.md` (#13), reduced-motion safe. Not shown to gate staff or receptionists. Notification permission is still asked in context, not here (FR-5.2). | M |

### 9.2 FR-2 Customer

| ID | Requirement | P |
|---|---|---|
| FR-2.1 | Home/discover: category entry (hotels, apartments, events), featured/popular, location-aware (nearby). | M |
| FR-2.2 | Search & filter listings (location, dates, price, category-specific filters); paginated (20/page). | M |
| FR-2.3 | Listing detail pages per type: hotels (room types, rates, breakfast options, airport transfer), apartments (calendar, pricing rules, rules), events (packages/tickets, date, venue, organizer, remaining tickets, sold-out/waitlist). Gallery, map, reviews. | M |
| FR-2.4 | Availability checking before booking; **booking lock** during checkout so two people don't pay for the last room/ticket. Locks expire; surface the countdown. | M |
| FR-2.5 | Booking flows: hotel (dates, guests, room type, extras), apartment, event (ticket quantities up to 20, attendee questions, promo code). Guest checkout allowed; signed-in prefill. | M |
| FR-2.6 | Price shown = server-computed price (promo, service charge, extras); never trust or send a client total as authoritative. | M |
| FR-2.7 | **Tickets**: list, detail, and a full-screen scannable code. If the booking has `customer_id`: show the **rotating code** (refresh ~every 28 s, countdown, auto-brightness boost, keep screen awake) and fall back to the static code with a clear notice when offline or the code API fails. If guest booking: show static code. Tickets must be **viewable offline once opened** (cache the booking/ticket details; the rotating code needs network). | M |
| FR-2.8 | Per-ticket status (valid / admitted with time), booking-level summary, seat assignment if any. | M |
| FR-2.9 | Pay with **Paystack** via hosted checkout in an **in-app browser tab** (`expo-web-browser`/`ASWebAuthenticationSession`, Chrome Custom Tabs), returning by universal link (DECISION-5). Poll payment status until terminal, show success/failed/pending clearly and **never double-charge on retry**. The redirect is never proof of payment; always confirm server-side. | M |
| FR-2.9a | Pay with **crypto (NOWPayments)** (DECISION-4): choose pay currency, open the hosted payment page in the in-app browser, handle the longer async lifecycle (waiting → confirming → finished) plus **expired, partially paid and failed** states with plain-language guidance, survive app kill and resume by reference, and show a persistent "payment pending" state on the booking. Crypto is never presented as instant. | M |
| FR-2.10 | My bookings (hotel/apartment/event): upcoming/past, statuses, details, hotel **check-in code QR** for the front desk (show the 8-char code large + QR; keep screen awake). | M |
| FR-2.11 | Cancel a booking (policy-aware), request a refund, view refund status; apartment change-request and dispute; booking messages with host. | S |
| FR-2.12 | **Transfer** an event ticket to another email. | S |
| FR-2.13 | Save/favourite listings; follow organizers; join event waitlist. | S |
| FR-2.14 | Reviews: prompt after stay/event; submit rating + text. | S |
| FR-2.15 | Notifications centre (in-app list from `notifications`, mark read/delete) **and** native push (BACKEND-REQ-5): booking confirmed/cancelled/updated, payment success/failed, check-in reminders (48 h), event reminders, review request. Tapping a notification deep-links to the booking/ticket (`notifications.link`/`data`). | M |
| FR-2.16 | Add to calendar (ICS) for confirmed bookings/events. | S |
| FR-2.17 | Share an event / listing (native share sheet, universal link). | C |
| FR-2.18 | Trips (itinerary grouping of services) — `trips`/`trip_services` exist on web. | C |
| FR-2.19 | Customer KYC upload if required by any flow (`/api/customer/kyc`). Confirm which flows require it. | C |
| FR-2.20 | Wallet: show balance/transactions only if product wants it; **no wallet payment** (410). | C |
| FR-2.21 | Support: help centre content, contact form / chat (`/api/support/chat`). | S |
| FR-2.22 | **Claim past guest bookings** made with the same verified email (DECISION-6, BACKEND-REQ-11): prompt after email verification, show what will be claimed, one-time confirm, clear result; empty state if none. | M |
| FR-2.23 | Profile: edit name, phone, state/address; change password; notification preferences; language/locale-aware ₦ formatting. | M |

### 9.3 FR-3 Gate staff

| ID | Requirement | P |
|---|---|---|
| FR-3.1 | After sign-in, list **events I can scan** (assigned + owned); select one; remember the last. Empty state: "No events assigned — ask the organiser." | M |
| FR-3.2 | **Camera scanner**: continuous scanning, multi-format QR, torch toggle, camera switch, permission-denied recovery, low-light handling, **no dependency on any network resource to decode** (decode on device; the web app had to self-host its WASM for exactly this reason). | M |
| FR-3.3 | **Manual entry** of a code / UUID as camera fallback; normalisation identical to `parseTicketCode` (§4.2). | M |
| FR-3.4–3.8 | **Offline roster, decisioning, lookup, group context** — §8.3, §8.4. | M |
| FR-3.9 | **Distinguish outcomes correctly:** Admitted, Already used (with time + by whom), Refused (with the specific reason), **Couldn't check / try again** (network error, 503, **429**, timeout). A transient failure must **never** be rendered as "Do not admit" — the web app currently does this for 429, which sends staff arguing with valid guests. | M |
| FR-3.10 | Full-screen result overlays with colour **and** icon **and** text (not colour alone), loud audio + haptic per outcome, mute toggle, per-outcome hold times as in §4.4 (refusals hold until dismissed). | M |
| FR-3.11 | **Scan queue** semantics ported from `lib/scan/queue.js`: queue-don't-drop, de-dupe, replay of settled results, concurrency 3, backoff retries (§4.4). Scanning must continue while requests are in flight. | M |
| FR-3.12 | **Door totals**: admitted / total, recent admissions (50), "mine" marker, refreshed periodically and after each scan; works from the local roster when offline (with an offline indicator). | M |
| FR-3.13 | Never expose **undo / un-admit** to gate staff. | M |
| FR-3.14 | Sync status bar + outbox view (pending, failed, suspect, duplicates) with "Sync now" and export (CSV/share) of the local log. | M |
| FR-3.15 | **Supervisor override** for "not in offline list" (DECISION-7). The roster's first page carries `override` (an object, or `null` when the organiser has not set a PIN; when `null`, do not offer the override). The PIN is six digits; verify it **locally**: `scrypt(PIN as UTF-8, salt, N, r, p, dk_len)` using the parameters in the object, then compare with `hash` in constant time (known-answer vector in `docs/superpowers/specs/2026-10-03-scan-override-pin-design.md`: PIN `123456`, salt hex `00112233445566778899aabbccddeeff`, N=8192, r=8, p=1, 32 bytes → hex `2fcc88228b3ff44028264aa2376b3642fea934ccca7bae4b334e4ad1f66d81e0`; check your implementation against it before shipping). Also require a reason (3–200 chars) and the approver's name. **The server cannot verify the PIN**, so the control is local: **lock the override for 15 minutes after 5 wrong attempts, with the counter persisted across app restarts**. Sync as `mode: "offline_override"` with `reason` and `approved_by`. A six-digit PIN protects against casual misuse only, not against someone attacking a stolen phone's cache, which is why the cache must be encrypted and every override is logged. | M |
| FR-3.16 | Shift summary at sign-out (counts admitted by me, duplicates, pending sync). | S |
| FR-3.17 | Keep screen awake and prevent auto-lock while a scan session is active. | M |

### 9.4 FR-4 Receptionist

| ID | Requirement | P |
|---|---|---|
| FR-4.1 | Load hotel context (`hotel_staff` → `hotels`); empty/error states exactly as web ("No hotel assigned", retry). | M |
| FR-4.2 | **Camera QR scan** of the guest's hotel check-in QR. Payload is the raw 8-character `check_in_code`. Accept the code case-insensitively, trim whitespace (server uppercases/trims). Reject anything not matching the code shape *client-side* with a clear message. **Do not** auto-commit: show the booking preview (GET check-in lookup) — guest, room, dates, payment status — then **confirm** to check in. | M |
| FR-4.3 | Manual code entry and **search** by guest name / phone / room / code across today's arrivals and current guests. | M |
| FR-4.4 | Check-in with all server rules surfaced: already checked in, cancelled, payment incomplete (allow `pay_at_hotel`), **early-arrival warning** (non-blocking), wrong hotel (403). | M |
| FR-4.5 | **Check-out** with the early-checkout warning; marks booking completed and frees the room. | M |
| FR-4.6 | **Current guests** list (checked in, room, dates, balance if applicable). | M |
| FR-4.7 | **Room status board** (available / occupied / dirty / reserved / under_maintenance / out_of_service); change status; cannot change an occupied room (409 message shown). | M |
| FR-4.8 | Today's dashboard: arrivals remaining, occupied, available, dirty; **live** via Realtime with polling fallback. | M |
| FR-4.9 | Receptionist **offline behaviour** — recommended online-only with clear "no connection" state and queued retry of the *current* action only (DECISION-2). Do not queue check-ins for later by default: a check-in changes room state and notifies the guest. | M |
| FR-4.10 | Recent-activity log for the shift (my check-ins/outs). | S |
| FR-4.11 | Notifications (new arrival reminders, booking changes) if the product wants them for staff. | C |

### 9.5 FR-5 Cross-cutting

| ID | Requirement | P |
|---|---|---|
| FR-5.1 | Deep links / universal links: ticket, booking, payment return, password reset, event. Cold-start and warm-start. | M |
| FR-5.2 | Push permission asked **in context** (after first booking), not on launch; per-category preferences. | M |
| FR-5.3 | Force-update and maintenance gate: server-driven minimum supported version, with a hard-block screen. | M |
| FR-5.4 | In-app legal: Terms, Privacy (existing web pages), links to support. | M |
| FR-5.5 | Localisation-ready strings (English at launch); ₦ formatting, `Africa/Lagos` time handling, Nigerian phone number validation. | M |
| FR-5.6 | Error reporting with user-facing recoverable messages; never show raw server errors or stack traces. | M |
| FR-5.7 | Feature flags / remote config for kill-switching a flow (e.g. payments, offline mode). | S |

---

## 10. Non-functional requirements

### 10.1 NFR-1 Performance and scale

| ID | Requirement |
|---|---|
| NFR-1.1 | Cold start to interactive ≤ 2.5 s on a mid-range Android (e.g. 3 GB RAM) on 4G; warm start ≤ 1 s. |
| NFR-1.2 | **Gate scan decision latency:** online ≤ ~700 ms p95 from decode to result (the server RPC is a single round trip; the web work in `docs/superpowers/plans/2026-08-02-gate-scanning-reliability-and-latency.md` targeted this); **offline ≤ 150 ms**. Camera must keep scanning during requests. |
| NFR-1.3 | Scanner throughput: sustain ≥ 1 scan/second per device for a long queue; camera decode ≤ 250 ms. |
| NFR-1.4 | List scrolling at 60 fps for 1,000+ items (roster search, bookings); use virtualised lists. |
| NFR-1.5 | Roster of **50,000 tickets** loads, indexes and searches locally in < 300 ms per query; sync in resumable pages of ≤ 2,000 rows; memory-bounded. |
| NFR-1.6 | App binary ≤ ~60 MB download; images lazy-loaded and sized; Cloudinary transformations for thumbnails. |
| NFR-1.7 | Battery: a 6-hour gate session on a mid-range phone must not exceed ~35 % drain when screen-on scanning with the camera (torch off); no busy loops while idle. |

### 10.2 NFR-2 Reliability and offline

| ID | Requirement |
|---|---|
| NFR-2.1 | **No lost admissions** — durable write-ahead outbox (FR-3.10); survives crash, kill, reboot, OS update. Test by killing the app mid-sync. |
| NFR-2.2 | Idempotent sync keyed by `(device_id, client_seq)`; safe to retry any number of times. |
| NFR-2.3 | Customer ticket display works offline once loaded (cache in secure local storage); rotating code gracefully degrades to the static code with a notice. |
| NFR-2.4 | Every network call: timeout, bounded retries with jitter, and **distinct handling of 401 (refresh/re-auth), 403, 404, 409, 429, 503**. A 429 or 503 is "try again", never a business decision. |
| NFR-2.5 | Payments: **never** assume success from the redirect; confirm through `/api/payment/verify` or the status endpoint; poll with backoff; survive app being killed during checkout (resume on next launch by reference). |
| NFR-2.6 | Degrade, don't die: if listings cache/Redis is down the API still answers; the app shows stale cached listings with a banner rather than a blank screen. |
| NFR-2.7 | Realtime (receptionist) reconnects automatically; falls back to polling. |

### 10.3 NFR-3 Security and privacy

| ID | Requirement |
|---|---|
| NFR-3.1 | Tokens in **Keychain / Keystore** (e.g. `expo-secure-store`), never AsyncStorage/plain files. |
| NFR-3.2 | **No secrets in the app**: never the Supabase service-role key, `TICKET_TOKEN_SECRET`, Paystack secret, or NOWPayments key. Only the public Supabase URL + anon key and the Paystack **public** key (if needed). |
| NFR-3.3 | The offline **roster is attendee PII** (name, phone, email). Store in an **encrypted** local DB with a key in the secure store; scope to events the user is assigned to; **expire** after the event + grace period; wipe on logout (after outbox is clear) and on assignment revocation. Fields are **name + masked phone only** (DECISION-8); full contact data is never stored on the device unless the vendor opts in for that event. |
| NFR-3.4 | TLS only; certificate pinning optional (C). Block cleartext. |
| NFR-3.5 | Authorisation is **always enforced server-side** (every route re-derives role/scope; `CLAUDE.md` warns that no route group implies a guard). The app hides what the user cannot do, but UI hiding is not security. Gate scans must pass `admit_ticket`'s owner/active-scanner check; receptionist routes must verify `hotel_staff` scope. |
| NFR-3.6 | **Never trust client pricing.** Send quantities/selections; the server recomputes amounts. (The old event flow accepted a client `discount_amount`; the fix is in `app/api/bookings/event/create/route.js`.) |
| NFR-3.7 | Screens showing tickets/booking codes: prevent screenshots where the OS allows it on rotating-code screens (`FLAG_SECURE` / equivalent) — note this conflicts with letting guests save a static ticket; decide per ticket type. Redact PII in the app switcher snapshot. |
| NFR-3.8 | Jailbreak/root detection and **device attestation** for the scanner mode (C). |
| NFR-3.9 | Logs and analytics must exclude PII, tokens, ticket codes and full emails/phones. |
| NFR-3.10 | Device-clock tamper guard for offline step checks (§8.6). |
| NFR-3.11 | Compliance: **NDPR / Nigeria Data Protection Act** — lawful basis, privacy notice, data-subject requests, retention; store/Play **data-safety** and **App Privacy** declarations; account deletion (FR-1.8). |
| NFR-3.12 | Third-party SDKs vetted; minimal permissions (camera, notifications; location only if "nearby" is shipped, with a precise rationale string). |

### 10.4 NFR-4 Compatibility and accessibility

| ID | Requirement |
|---|---|
| NFR-4.1 | iOS ≥ 15.1 (confirm vs. Expo SDK) and Android ≥ 8 (API 26)+ (Not verified: pick from Expo SDK's supported baseline and Nigerian device share). |
| NFR-4.2 | Phones first; tablets usable (receptionist desks may use tablets); portrait primary, landscape tolerated for the scanner and front desk. |
| NFR-4.3 | Designed for **low-end Android, flaky 3G/4G, and data cost**: lean payloads, image compression, offline-first where listed, a "data saver" mode (C). |
| NFR-4.4 | **Accessibility:** WCAG 2.1 AA; dynamic type; VoiceOver/TalkBack labels; touch targets ≥ 44 pt; contrast checked against the violet palette; scan outcomes use colour **+** icon **+** text **+** haptic/audio. |
| NFR-4.5 | Light theme only (product decision); respect OS font scaling and reduced motion. |

### 10.5 NFR-5 Observability, release, quality

| ID | Requirement |
|---|---|
| NFR-5.1 | Crash and error reporting (e.g. Sentry) with release/build tagging and source maps. |
| NFR-5.2 | Product analytics (privacy-respecting, no PII): funnel for search → listing → checkout → paid; scan success/refusal/failure rates; offline-session counts; sync conflict counts. |
| NFR-5.3 | Per-scan timing telemetry using the `Server-Timing` header so a slow door is diagnosable (the web team's stated reason for adding it). |
| NFR-5.4 | **CI:** typecheck, lint, unit tests on every PR; EAS Build for preview + production profiles; OTA updates (EAS Update) with channel per environment and a rollback path. |
| NFR-5.5 | **Environments:** dev / staging / production with separate Supabase projects and test-mode vs live payment keys. (A staging environment is a planned web-repo effort — `chore/staging-environment`; coordinate.) Production Supabase is live: **never run destructive tests against it**. |
| NFR-5.6 | App-version header (`X-App-Version`, `X-Platform`) on every API call so the backend can gate or log by client. |
| NFR-5.7 | Store compliance checklist: privacy policy URL, support URL, screenshots, review notes with **test credentials for each mode** (customer, gate staff, receptionist), payment-provider disclosures, camera/notification purpose strings. |

---

## 11. Testing and acceptance

### 11.1 Test accounts

`.env.test.example` in the web repo defines only a single customer account. There are **no** vendor, gate-staff or receptionist test accounts. Provision them through the **real flows** (vendor creates a gate-staff account via the roster UI; admin/vendor creates a receptionist via `hotel_staff`) rather than inserting rows, so provisioning itself is exercised. The DB was wiped to one admin row; empty tables are expected.

### 11.2 Acceptance scenarios (minimum)

**Gate (online)**
1. Valid rotating code → admitted, overlay green, door total +1, audible/haptic.
2. Same code twice (this device) → instant "already used", no server call.
3. Same ticket on a second phone → "already checked in" with time and name.
4. Expired rotating code → "Ask them to refresh"; refresh → admitted.
5. Printed code on `require_dynamic_ticket` event → `static_not_allowed`.
6. Ticket from another event → `wrong_event`; unassigned scanner → `forbidden`.
7. Throttled (429) and server 503 → "try again", **not** a denial.
8. Two-ticket order admitted one ticket at a time; sibling status shown.

**Gate (offline)**
9. Download roster, go airplane mode, scan a valid `BH2` ticket → admitted offline in < 150 ms.
10. Kill the app mid-scan session; relaunch → pending admissions intact.
11. Reconnect → auto-sync; per-item results reconcile; counts match server.
12. Two phones admit the same ticket offline → one succeeds, the other shows in "Duplicate admissions".
13. Ticket not in roster → refused with override path (if enabled).
14. Phone clock set +10 minutes → warning and degraded behaviour.
15. Logout with pending outbox → blocked until synced/exported.
15a. Tampered `BH2` code (altered ticket id or step) → refused offline as invalid, never admitted.
15b. `BH1` code offline → "can't verify offline", not admitted on ID alone.
15c. Unknown `kid` (key rotated) → roster refresh prompted; refuse until resolved.
15d. Unlisted ticket → override needs the correct PIN; wrong PIN N times locks the override; the exception syncs with the reason.
15e. Roster contains name + masked phone only (inspect the local DB: no email, no full phone).

**Receptionist**
16. Camera-scan a valid code → preview → confirm → room occupied, guest notified.
17. Scan a code for a different hotel → 403 message, nothing changes.
18. Scan an already-checked-in guest → clear 409 message.
19. Unpaid booking → blocked; `pay_at_hotel` → allowed.
20. Early arrival → warning shown, staff can proceed.
21. Two staff scan the same guest simultaneously → exactly one succeeds (requires BACKEND-REQ-4).
22. Room status change on an occupied room → blocked with message.

**Customer**
23. Guest checkout and signed-in checkout both complete; price equals server-computed total.
24. Kill the app during Paystack checkout → on return, status resolves correctly without a double charge.
25. Rotating code displayed, refreshes before expiry; offline → falls back to static with notice.
26. Last ticket race: two customers, one succeeds, the other gets a clear "sold out/lock expired".
27. Push received for booking confirmation; tap opens the booking.
28. Crypto payment: expired, underpaid and finished states each resolve correctly after killing the app mid-payment.
29. Claim past guest bookings: only bookings with the verified email are claimed; a booking owned by another account is never claimed; running it twice changes nothing.

### 11.3 Tools in the web repo that can verify backend claims

`concurrency-load-tester` (double-admit, double-check-in, booking locks), `security-auditor` (bearer-auth routes, receptionist scoping, IDOR), `db-rls-auditor` (RLS on `hotel_*`, `event_*`), `functional-flow-tester`, `performance-auditor`. Existing tests: `test/scan-queue.test.mjs` (unit, Node test runner), Playwright e2e in `e2e/`.

---

## 12. Delivery phasing (suggested)

| Phase | Scope | Blocked by |
|---|---|---|
| **0 — Foundations** | Expo project, design tokens/fonts, Supabase client, secure storage, navigation shell with mode resolution, API client with `X-App-Version`, error taxonomy (NFR-2.4), CI/EAS, Sentry | BACKEND-REQ-1 |
| **1 — Gate staff (online)** | Event list, camera scanner, queue port, totals, outcome UX | BACKEND-REQ-1 |
| **2 — Gate staff (offline)** | Encrypted roster, **offline signature verification**, decisioning, outbox, sync, conflicts, supervisor override | BACKEND-REQ-2, 3, **9 (asymmetric codes)**, 12 |
| **3 — Receptionist** | Context, dashboard, camera check-in, check-out, room board | BACKEND-REQ-1, 4, 6 |
| **4 — Customer core** | Discover, listing detail, booking, **Paystack + crypto** payment, my bookings, tickets, push, guest-booking claim | BACKEND-REQ-1, 5, 7, 8, 11, 13 |
| **5 — Customer extras** | Cancel/refund, transfer, reviews, favourites, waitlist, support | |
| **6 — RFQ verticals** | Car rental / logistics / security requests & offers | DECISION-3 |

Rationale for ordering: Phases 1–3 are small and well-defined. **Phase 2 now depends on a web-side change to the ticket-code format (BACKEND-REQ-9)**, so start that early and in parallel with Phase 1; the mobile app can ship Phase 1 online-only scanning first. If launch is customer-led, reorder 4 ahead of 2.

---

## 13. Decisions (all resolved 2026-10-02)

| ID | Question | **Decision** | Consequence |
|---|---|---|---|
| **DECISION-1** | Offline rotating-code policy | **C — asymmetric (public-key) signed codes (`BH2`)**; phones verify offline with no secret | BACKEND-REQ-9 is P0 for the offline phase; web ticket page and scan route change; QR gets denser; `BH1` retired after transition (§8.2). |
| **DECISION-2** | Receptionist offline | **Online-only**; retry only the current action | FR-4.9. No queued check-ins. |
| **DECISION-3** | Customer v1 verticals | **Hotels, apartments, events**; RFQ verticals later | §1.2, phase 6. |
| **DECISION-4** | Crypto / wallet in v1 | **Paystack + crypto (NOWPayments)**; wallet deposit not in v1; wallet pay stays off | FR-2.9a, BACKEND-REQ-13; more payment states to test. |
| **DECISION-5** | Paystack in-app method | **In-app browser tab** with universal-link return + server verification (native SDK considered and dropped) | FR-2.9, BACKEND-REQ-8. Crypto uses the same mechanism. |
| **DECISION-6** | Past guest bookings | **Claim by verified email** | FR-2.22 (must), BACKEND-REQ-11. |
| **DECISION-7** | Offline override for unlisted tickets | **Allow with per-event supervisor PIN**, always logged as an exception | FR-3.15 (must), BACKEND-REQ-12. |
| **DECISION-8** | Offline roster PII | **Name + masked phone**; full contact only on vendor opt-in | BACKEND-REQ-3, NFR-3.3, FR-3.7. |
| **DECISION-9** | OS floor / Expo SDK | **Latest stable Expo SDK; derive the OS floor from it** (default, not yet confirmed by the owner) | Revisit against the Nigerian device mix before release. |
| **DECISION-10** | Repo layout / contract types | **Single Expo app**; generate types from the Supabase schema; hand-maintain route contracts (default, not yet confirmed by the owner) | Reconsider a monorepo only if a shared package is needed. |

---

## 14. Known issues and traps in the existing system

1. **429 shown as "Do not admit"** in the web gate UI — do not copy (FR-3.9).
2. **Server actions are unreachable from mobile** — the largest hidden cost on the customer side (BACKEND-REQ-7).
3. **Notification writes silently succeed with 0 rows** on a stale session (PR #130) — always verify affected rows and refresh/retry.
4. **Guest checkout is the norm** — logic that assumes `customer_id` will mis-handle most existing data; rotating codes need `customer_id`.
5. **`getVerifiedUser()` is effectively unused**; local JWT checks accept a revoked-but-unexpired token for up to an hour. Money movement and sensitive actions should use the verified path (audit §1.8).
6. **Hotel check-in is not atomic** (BACKEND-REQ-4).
7. **Wallet pay returns 410 by design**; don't build it.
8. **Hotel check-in QR has no signature** — it's the raw 8-char code. Anyone who sees a guest's code can present it; the server still requires an authorised receptionist for that hotel and a paid/confirmed booking, which bounds the risk, but treat it as a bearer secret on screen.
9. **`admit_ticket` stamps server time at call time** — offline scans need BACKEND-REQ-2 to preserve real scan times.
9a. **Rotating codes are HMAC-signed today** — the offline design depends on the `BH2` migration (BACKEND-REQ-9); until it ships, offline mode cannot verify live codes.
10. **Production is live-with-test-keys** — no destructive tests, no real webhook deliveries from test rigs.
11. Pre-launch audit findings live in `docs/PRELAUNCH_AUDIT.md`; it is the canonical status list — read it before relying on any route's guard.

---

## 15. Appendix — reference excerpts

### 15.1 Code shapes the app must parse

```
Rotating (today)   : BH1.<32 hex ticketId, no dashes>.<step in base36>.<22 base64url chars>   (HMAC)
Rotating (planned) : BH2.<kid>.<22 base64url id>.<step base36>.<86 base64url Ed25519 sig>   (§8.2)
           step = floor(epochSeconds / 30); valid if |nowStep − step| ≤ 1
Static   : https://<host>/t/<uuid>      or      <uuid>
Hotel    : <8 alphanumeric chars>   (check_in_code, uppercase)
```

`UUID_RE` used by the web scanner: `/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i`.

### 15.2 Notification types the backend emits to customers (`lib/notifications.js`)

`notifyBookingPending`, `notifyBookingConfirmed`, `notifyBookingCancelled`, `notifyBookingUpdated`, `notifyPaymentSuccessful`, `notifyPaymentFailed`, `notifyWalletDeposit`, `notifyPasswordChanged`, `notifyReviewRequest`, `notifySystem` (e.g. check-in welcome), `notifyRequestSubmitted`, `notifyQuoteReceived`, `notifyCustomerNewOffer`, `notifyCustomerRequestExpired`, `notifyCustomerOfferWithdrawn`. Reminder jobs: `/api/notifications/checkin-reminders`, `…/hotel-reminders`, `…/event-reminders`, `…/engagement`.

### 15.3 Hotel booking states (observed)

`booking_status`: `confirmed → checked_in → completed`, or `cancelled`. `payment_status` considered paid: `completed` or `paid` (`isBookingPaid` in `lib/payment/constants.js`); `pay_at_hotel` may check in.

### 15.4 Key web files to read first

`app/api/events/[id]/scan/route.js`, `…/scan/summary/route.js`, `supabase/migrations/20260802064031_admit_ticket_rpc.sql`, `lib/ticket-tokens.js`, `lib/scan/queue.js`, `app/scan/client.jsx`, `app/scan/feedback.js`, `app/api/bookings/hotel/checkin/route.js`, `app/receptionist/dashboard/page.jsx`, `components/shared/dashboard/receptionist/*`, `lib/auth/session.js`, `lib/rate-limit/tiers.js`, `lib/notifications.js`, `lib/payment/service.js`, `docs/PUSH_NOTIFICATIONS.md`, `docs/PRELAUNCH_AUDIT.md`, `docs/superpowers/plans/2026-08-02-gate-scanning-reliability-and-latency.md`.

### 15.5 Not covered / not verified in this pass

Full request/response shapes of most customer routes (§7.2 lists them, but only the scan, check-in, event-create, payment-initialize, ticket-code and push routes were read in detail); the web registration/server-action side effects; the receptionist checkout and room-status scoping; apartment booking internals; trips; KYC requirements; Paystack callback mechanics for non-web clients; Realtime publication/RLS for the `hotel_*` tables from a mobile client; the production base URL and public keys. Treat these as discovery tasks in Phase 0, and run the `security-auditor` / `db-rls-auditor` agents on the bearer-auth routes before launch.
