# Backend status vs. the mobile requirements

**Verified 2026-10-04** by reading `../web` (branch `general`, ≈ `main`) — code and migrations only, nothing was run. This **supersedes** `MOBILE_APP_REQUIREMENTS.md` wherever they disagree. Re-verify before relying on an item for a release; the web repo moves fast.

Web paths below are relative to `/Users/mac/Developer/bookhushly/web/`. `../web-aw` is just another git worktree of the same repo — ignore it. The web repo also carries a newer copy of the requirements doc at `docs/mobile/MOBILE_APP_REQUIREMENTS.md` (annotated with what's done) and specs under `docs/superpowers/specs/` (`2026-10-02-signed-ticket-codes-design.md`, `2026-10-03-offline-scan-backend-design.md`, `2026-10-03-scan-override-pin-design.md`, `2026-10-03-atomic-hotel-checkin-design.md`).

## 1. BACKEND-REQ status

| REQ | Status | Notes |
|---|---|---|
| 1 Bearer auth | **Done** (PR #157) | `lib/auth/bearer.js`, `lib/supabase/{server,bearer-client,middleware}.js` |
| 2 Batch admit | **Done** | `app/api/events/[id]/scan/batch/route.js` |
| 3 Roster | **Done, with deviations** | no ETag; masked phone only; see §3 |
| 4 Atomic hotel check-in | **Done** | RPC `check_in_hotel_booking`; stable error `code`s |
| 5 Native push | **Not done** | `/api/push/subscribe` is Web Push only (`endpoint`,`p256dh`,`auth`) |
| 6 Receptionist scoping | **Done** | room status, checkout, check-in GET preview now hotel-scoped |
| 7 Customer HTTP APIs | **Not done** | see §7 |
| 8 Deep links | **Not done** | no `.well-known`, no AASA/assetlinks, no app-scheme return |
| 9 BH2 signed codes | **Done but OFF by default** | issued only when `TICKET_TOKEN_FORMAT=2` + keys provisioned. Production state unknown — ask the owner |
| 10 Token TTL | Partial | only local `supabase/config.toml` (`jwt_expiry=3600`, refresh rotation on); dashboard unconfirmed |
| 11 Claim by email | **Not done** | no route/RPC |
| 12 Override PIN | **Done** | `lib/scan/override-pin.js`, `event_scan_settings`; PIN managed by vendor server actions on web |
| 13 NOWPayments native | Partial | hosted `invoice_url` returned; no return/deep-link strategy |

## 2. Corrections to the handover doc

1. **BH2 format** is `BH2.<kid>.<id>.<step>.<sig>` with `kid` 1–8 chars `[a-z0-9]`, `id` = the 16 UUID bytes as **22 base64url chars** (not 32 hex), `step` = `floor(epochSec/30)` base36, `sig` = **86 base64url chars** Ed25519 over the string **`bh2:<kid>:<uuid lowercase dashed>:<step>`**. Verify results: `malformed | expired | unknown_key | bad_signature`. Tolerance ±1 step live, **±10 steps in batch sync**.
2. **Roster has no ETag**; use `cursor` + `since`. No vendor opt-in for full phone — masked phone only, never email.
3. Hotel check-in has a new `room_occupied` code. Check-in GET preview is hotel-scoped.
4. Event booking routes exist (`/api/bookings/event/create`, `/free`, `/[id]`, `/cancel`, `/transfer`) — the doc's §7 under-lists them.
5. `POST /api/bookings/apartment` takes **multipart `formData`**, not JSON.
6. Production base URL: `https://www.bookhushly.com` (confirm apex↔www redirect). Staging: `https://staging.bookhushly.com`.
7. Supabase URL: `https://wdhhbgxdpjjuqjideqws.supabase.co` (public). Anon key lives in `web/.env.local` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public by design; never touch the service-role key.

## 3. Gate staff contracts (all accept `Authorization: Bearer <access_token>`)

**Live scan** `POST /api/events/{id}/scan` `{ticket_id}` → `{ok, ticket, booking}`; refusal `{error, code}`. Status map: `forbidden` 403, `not_found` 404, `invalid_code` 400, `lookup_failed` 503, and `booking_qr | wrong_event | not_confirmed | static_not_allowed | already_checked_in | expired_code` 409. 429 is a rate limit, **never a denial**.

**Summary** `GET /api/events/{id}/scan/summary` → `{admitted, total, recent[]}`.

**Roster** `GET /api/events/{id}/scan/roster?cursor=<ticketUuid>&limit=1..5000(default 2000)&since=<ISO>`
→ `{ok, event:{id,title,event_date,require_dynamic_ticket,total,admitted}, tickets:[{id,ticket_type,ticket_index,booking_id,booking_status,checked_in_at,scanned_by,by_me,holder_name,phone_masked,seat}], next_after, server_time}`.
- **First page only** also has `keys` (Ed25519 public key set), `keys_error`, and `override` (`null` or `{enabled, alg:"scrypt", N, r, p, dk_len, salt, hash, set_at}`; defaults N=8192 r=8 p=1 dk_len=32, base64url salt/hash, 6-digit PIN).
- Keyset pagination ordered by `id`; loop until `next_after` is null. `no-store, private`.
- `since` returns only tickets created/checked-in after the time and does **not** reflect later cancellations/refunds → do a full refresh periodically.
- Auth: event owner, or scanner active in **both** `event_scanners` and `vendor_scanners`. Errors: 403 `forbidden`, 404 `not_found`, 400 bad param, 503 `roster_failed`.
- Guest bookings usually have `holder_name = null` → lookup by phone digits.

**Batch** `POST /api/events/{id}/scan/batch`
- Request `{device_id (8–64 chars [A-Za-z0-9_-]), items:[{client_seq (int ≥0, unique), ticket_id (uuid or BH1/BH2, ≤400 chars), scanned_at (ISO), mode:"offline"|"offline_override"|"manual_lookup", reason? (≤200), approved_by? (≤80)}]}`; 1–200 items. `offline_override` needs `reason` (≥3 chars) and `approved_by`.
- Response 200 `{results:[{client_seq, ok, code, replayed, …}]}`, `no-store`. `ok` → `ticket, checked_in_at (backdated to client time), booking:{id,total_tickets,checked_in_count}`. `already_checked_in` → `ticket, checked_in_at, scanned_by (name), by_me`.
- Item codes: `ok, already_checked_in, not_found, forbidden, wrong_event, not_confirmed, static_not_allowed, booking_qr, bad_timestamp, expired_code, invalid_code, bad_item`.
- Idempotent on `(user, device_id, listing, client_seq)`; replay returns stored result with `replayed:true`. `scanned_at` clamped to ≥30 days ago; >5 min in the future → `bad_timestamp`. 503 `sync_failed` → keep the queue and retry.
- BH1 is admitted in batch only if the HMAC verifies server-side; `offline_override`/`manual_lookup` skip the liveness proof and are logged with mode/reason/approver.

**Customer code** `GET /api/tickets/{ticketId}/code` → `{token, format(1|2), expires_at(ms), step_seconds, ticket}`. 401; 403 not holder (guest bookings have no `customer_id`); 404; 409 not confirmed / already used; 503.

**Keys** `GET /api/ticket-keys` (no auth) → `{alg:"Ed25519", format:2, step_seconds:30, keys:[{kid, publicKey (raw 32B base64url), signing}]}`. Empty `keys` = BH2 not set up; 503 = retry. Cached 60 s.

**Gap:** "events I can scan" is a server action (`getMyScannableEvents`, `lib/eventscanners.js`). Either read `event_scanners` joined to `listings` under RLS, or ask web for a route.

## 4. Receptionist contracts

- **Check-in** `POST /api/bookings/hotel/checkin` `{booking_id}` or `{code (≤32)}`; `booking_id` wins. Allowed: admin, owning vendor, receptionist assigned to that hotel. 200 `{success, warning?, booking:{id,guest_name,check_in_date,check_out_date,hotel_name}}`. Errors `{error, code}`: `bad_request` 400, `cancelled` 400, `not_paid` 400, `forbidden` 403, `not_found` 404, `already_checked_in` 409 (+`checked_in_at`,`guest_name`), `room_occupied` 409 (+`room_number`), `check_in_failed` 500, `unexpected` 500. Paid = `completed | paid | pay_at_hotel`.
- **Preview** `GET /api/bookings/hotel/checkin?code=` → `{booking}` (includes guest email/phone); 403/404/400/500.
- **Checkout** `POST /api/bookings/hotel/checkout` `{booking_id}` → codes `already_checked_out` 409, `not_checked_in` 400, `not_found`, `forbidden`, `bad_request`.
- **Room status** `PATCH /api/hotel/rooms/{roomId}/status`; 409 when occupied.

## 5. Payments

- `POST /api/payment/initialize` `{requestId, requestType: logistics|security|hotel|apartment|event, amount, currency="NGN", email, provider:"paystack"|"crypto", payCurrency (required for crypto), metadata}` → `{success, payment:{id, reference, provider, amount, base_amount, service_charge_amount, service_charge_label, currency, payment_url, access_code, order_id, invoice_id, pay_currency}, message}`. Server recomputes price. Crypto `payment_url` is the hosted NOWPayments invoice.
- `callback_url` = `${NEXT_PUBLIC_BASE_URL}payment/callback?reference=…&provider=…` (a web page; **no app return exists**). Note: built without a slash, so the env value must end in `/`.
- Status: `GET /api/payment/status/{reference}` → `{payment:{id, reference, amount, currency, status, paid_at, channel, fulfilled, created_at, metadata, request_type}, request}`. `status` is the raw DB value (crypto: `waiting|confirming|sending|partially_paid|expired|failed|finished`). No explicit auth check — relies on RLS; verify a bearer client can poll it. Also `/verify`, `/check-status`, `/reconcile`.

## 6. Auth / signup

- Login: use `supabase-js` `signInWithPassword` directly.
- **Signup is a server action only** (`app/actions/auth.js`): `admin.auth.admin.generateLink` + manual insert into `public.users` (rolls back the auth user on failure) + app-sent Resend email. No DB trigger. **Mobile cannot sign up until web adds a route or trigger.**
- Email confirmation is required; confirm/recovery links go to the web `/auth/confirm?token_hash=…&type=signup|recovery` (server `verifyOtp`), `next` must be same-origin. No mobile redirect URLs are allowlisted.
- No customer account-deletion endpoint (App Store requires one if sign-up is in-app). No min-version/maintenance/`X-App-Version` handling.

## 7. Customer API gaps

| Flow | State |
|---|---|
| Hotel booking | **Server action only** (`bookHotelRoomAction` → `book_hotel_room` RPC). `POST /api/bookings/hotel` only sends a notification. |
| Apartment booking | `POST /api/bookings/apartment` exists but multipart + admin client. |
| Event booking | HTTP routes exist (see §2.4). |
| My bookings | No list route — server actions / direct RLS reads. |
| Trips, messages, KYC submit | Server actions. `GET /api/customer/kyc` exists. |
| Saved listings, reviews, organizers, waitlist | HTTP routes exist. |
| Listings | `GET /api/listings?category=…` (required): `page` (0-based, 20/page), `search, sort, city, state, price_min, price_max, min_rating` + per-category filters. → `{items, nextPage?, totalCount|null}`. Anonymous; `s-maxage=30`. `GET /api/listings/{id}`, `/lock` exist. |

## 8. Risks

- **Staging blocks Bearer.** `proxy.js` rejects non-Basic `Authorization` on any deploy with `STAGING_BASIC_AUTH_*` set (except allowlisted paths like `/api/health`, `/api/payment-callback`). Mobile against staging needs a path exemption or separate gate.
- **Revocation:** local JWT verification means a revoked/deleted user's token works until expiry (`getVerifiedUser` unused; audit §1.8) — also on the batch route.
- `docs/PRELAUNCH_AUDIT.md` (2026-08-17) in web lists open P0s; read it before relying on any route's guard. Hotel bookings have no concurrency lock; `GET /api/bookings/apartment/[id]` does `select *` without an explicit auth check.
- The web DB is live production with test-mode payment keys. **No destructive tests**; provision test accounts through real flows.

## 9. Web-side work to request (not mobile work)

Signup route/trigger · hotel-booking JSON route · apartment booking JSON · my-bookings route · scannable-events route · universal links + AASA/assetlinks + app return for payments · native push (REQ-5) · claim-by-email (REQ-11) · account deletion · min-version/maintenance endpoint · staging Bearer exemption · confirm `TICKET_TOKEN_FORMAT=2` + keys in production.

## 10. Verified during Phase 0 (2026-10-04)

- `GET /api/customer/kyc` (Bearer works; `public` rate tier, 60/min/IP): 200 `{ kyc: null | { id, status: 'verified'|'rejected'|'pending', submitted_at, admin_note: string|null, nin_verified: boolean } }`; **401 body is `{ status: null }`** (no `error`/`code` — branch on the HTTP status); **a DB failure also returns 200 `{ kyc: null }`**, indistinguishable from "no KYC"; no `Cache-Control`. The column default `status='verified'` looks odd (insert path not read).
- `GET /api/health` (public, no staging Basic-auth wall): 200 `{ ok: true, db: 'up', ts }`; 503 `{ ok: false, db: 'down', ts }`; `no-store`.
- Mode resolution reads (RLS, verified in the baseline migration): `users` select own, `hotel_staff` (`hotel_staff_read_own`), `event_scanners` (`event_scanners_self_select`). Scan/roster also need an active `vendor_scanners` row, which mobile cannot see → a mismatch surfaces later as `forbidden`.
- Production Supabase issues the **legacy anon JWT** key (`role: anon`), not a publishable key.
- Still missing on the backend (see §9): sign-up/forgot-password routes, universal links, min-version endpoint, staging Bearer exemption, scannable-events route.
