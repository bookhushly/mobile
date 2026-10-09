# Backend status vs. the mobile requirements

**Verified 2026-10-04** by reading `../web` (branch `general`, ≈ `main`), **§6/§6a re-verified 2026-10-08** against web `origin/main` @ `30c7da90` (native auth, PR #206) — code and migrations only, nothing was run. This **supersedes** `MOBILE_APP_REQUIREMENTS.md` wherever they disagree. Re-verify before relying on an item for a release; the web repo moves fast.

Web paths below are relative to `/Users/mac/Developer/bookhushly/web/`. `../web-aw` is just another git worktree of the same repo — ignore it. The web repo also carries a newer copy of the requirements doc at `docs/mobile/MOBILE_APP_REQUIREMENTS.md` (annotated with what's done) and specs under `docs/superpowers/specs/` (`2026-10-02-signed-ticket-codes-design.md`, `2026-10-03-offline-scan-backend-design.md`, `2026-10-03-scan-override-pin-design.md`, `2026-10-03-atomic-hotel-checkin-design.md`).

## 1. BACKEND-REQ status

| REQ                                      | Status                                                                     | Notes                                                                                                 |
| ---------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 1 Bearer auth                            | **Done** (PR #157)                                                         | `lib/auth/bearer.js`, `lib/supabase/{server,bearer-client,middleware}.js`                             |
| 2 Batch admit                            | **Done**                                                                   | `app/api/events/[id]/scan/batch/route.js`                                                             |
| 3 Roster                                 | **Done, with deviations**                                                  | no ETag; masked phone only; see §3                                                                    |
| 4 Atomic hotel check-in                  | **Done**                                                                   | RPC `check_in_hotel_booking`; stable error `code`s                                                    |
| 5 Native push                            | **Not done**                                                               | `/api/push/subscribe` is Web Push only (`endpoint`,`p256dh`,`auth`)                                   |
| 6 Receptionist scoping                   | **Done**                                                                   | room status, checkout, check-in GET preview now hotel-scoped                                          |
| 7 Customer HTTP APIs                     | **Not done**                                                               | see §7                                                                                                |
| 8 Deep links                             | **Not done**                                                               | no `.well-known`, no AASA/assetlinks, no app-scheme return                                            |
| 9 BH2 signed codes                       | **Done but OFF by default**                                                | issued only when `TICKET_TOKEN_FORMAT=2` + keys provisioned. Production state unknown — ask the owner |
| 10 Token TTL                             | Partial                                                                    | only local `supabase/config.toml` (`jwt_expiry=3600`, refresh rotation on); dashboard unconfirmed     |
| 11 Claim by email                        | **Not done**                                                               | no route/RPC                                                                                          |
| 12 Override PIN                          | **Done**                                                                   | `lib/scan/override-pin.js`, `event_scan_settings`; PIN managed by vendor server actions on web        |
| 13 NOWPayments native                    | Partial                                                                    | hosted `invoice_url` returned; no return/deep-link strategy                                           |
| Native auth (signup/verify/reset/delete) | **Done on web `main`** (PR #206, `30c7da90`); production deploy UNVERIFIED | see §6, §6a                                                                                           |

## 2. Corrections to the handover doc

1. **BH2 format** is `BH2.<kid>.<id>.<step>.<sig>` with `kid` 1–8 chars `[a-z0-9]`, `id` = the 16 UUID bytes as **22 base64url chars** (not 32 hex), `step` = `floor(epochSec/30)` base36, `sig` = **86 base64url chars** Ed25519 over the string **`bh2:<kid>:<uuid lowercase dashed>:<step>`**. Verify results: `malformed | expired | unknown_key | bad_signature`. **Verified 2026-10-07 (web `origin/main` `c8fe25e8`):** the signed message is `bh2:<kid>:<uuid lowercase dashed>:<step as a DECIMAL integer>` (not base36, despite the token carrying base36); all base64url is unpadded and canonical (re-encode must match, else `malformed`); step is 1–10 base36 chars with no leading zeros; the server checks expiry before key and signature; any published kid verifies regardless of its `signing` flag; the server verifies with Node crypto (OpenSSL), mobile with `@noble/curves` using `{ zip215: false }`. Tolerance ±1 step live, **±10 steps in batch sync**.
2. **Roster has no ETag**; use `cursor` + `since`. No vendor opt-in for full phone — masked phone only, never email.
3. Hotel check-in has a new `room_occupied` code. Check-in GET preview is hotel-scoped.
4. Event booking routes exist (`/api/bookings/event/create`, `/free`, `/[id]`, `/cancel`, `/transfer`) — the doc's §7 under-lists them.
5. `POST /api/bookings/apartment` takes **multipart `formData`**, not JSON.
6. **Production API base URL: `https://bookhushly.com` (apex).** `www.bookhushly.com` answers with a **308 redirect to the apex**, and `fetch` drops the `Authorization` header on that cross-origin redirect, so Bearer calls via `www` come back 401 (verified 2026-10-05). Never use `www` for API calls. Staging: `https://staging.bookhushly.com`.
7. Supabase URL: `https://wdhhbgxdpjjuqjideqws.supabase.co` (public). Anon key lives in `web/.env.local` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — public by design; never touch the service-role key.

## 3. Gate staff contracts (all accept `Authorization: Bearer <access_token>`)

**Live scan** `POST /api/events/{id}/scan` `{ticket_id}` → `{ok, ticket, booking}` (verified 2026-10-05, `app/api/events/[id]/scan/route.js`).

- Status map: `forbidden` 403 (also an unknown listing), `not_found` 404, `lookup_failed` 503 (also a non-UUID listing id), `invalid_code` **409 for a rotating code (malformed, bad signature, unknown key) and 400 for a static non-UUID**, and 409 for `booking_qr | wrong_event | not_confirmed | static_not_allowed | already_checked_in | expired_code`. Unknown codes default to 409.
- Refusal bodies always carry `checked_in_at, scanned_by, ticket, ticket_count`, null unless set. `already_checked_in` → `ticket:{ticket_type, ticket_index}` (no id or seat); `scanned_by` is the scanner's **name, or their email when they have no name** (PII; batch returns the name only). `booking_qr` sets `ticket_count`.
- **`by_me` and name-only `scanned_by` came from web PR #192 (commit `104d7d3b`); PR #192 and #205 are on web `main` (checked 2026-10-07, `c8fe25e8`).** Production probe 2026-10-07 (signed out): `/api/events/scannable`, `…/scan/roster` and `…/scan/batch` return 401; `/api/ticket-keys` returns one signing key, `kid "1"`. Whether customers are issued BH2 (`TICKET_TOKEN_FORMAT=2`) is unverified until a real ticket is checked. Historical 2026-10-05 note: There `already_checked_in` carries `scanned_by` = scanner name, or `"gate staff"` if unnamed; never an email; and `by_me: true|false`, or both `null` if the lookup fails (don't guess). Until the PR is deployed, `scanned_by` may still be an email and `by_me` is absent: treat a missing `by_me` as unknown.
- 401 `{error}` and 400 `ticket_id is required` have no `code`. `Server-Timing: auth, rpc, total` is on 200, refusals and 503 only. No `Cache-Control`.
- **Rate limit:** tier `gate`, 1200 requests / 60 s sliding window, keyed per user (Bearer verified in `proxy.js`), shared by scan, summary, batch and roster. Fails open if Redis is down. A 429 body is `{error:"Too many requests. Please slow down."}` with **no `code` and no `Retry-After`**; use `X-RateLimit-*` headers. 429 is a rate limit, **never a denial**. On the PR branch, 429 is `{error, code:"rate_limited", retry_after}` with `Retry-After` header (seconds, ≥1); until deployed it has no `code` and no `Retry-After`.

**Summary** `GET /api/events/{id}/scan/summary` → 200 `{admitted, total, recent:[{id, ticket_type, checked_in_at, scanned_by_me}]}`, newest first, 50 items, `Cache-Control: no-store`. No scanner name, `ticket_index` or seat in `recent`. Errors have no `code`: 401 `{error:"Unauthorized"}`, 403 `{error:"Forbidden"}`, 503 `{error:"Couldn't load totals"}`. Same `gate` rate bucket.

**Roster** `GET /api/events/{id}/scan/roster?cursor=<ticketUuid>&limit=1..5000(default 2000)&since=<ISO>`
→ `{ok: true, event:{id,title,event_date,require_dynamic_ticket,total,admitted}, tickets:[{id,ticket_type,ticket_index,booking_id,booking_status,checked_in_at,scanned_by,by_me,holder_name,phone_masked,seat}], next_after, server_time}`.

- **First page only** also has `keys` (Ed25519 public key set), `keys_error`, and `override` (`null` or `{enabled, alg:"scrypt", N, r, p, dk_len, salt, hash, set_at}`; defaults N=8192 r=8 p=1 dk_len=32, base64url salt/hash, 6-digit PIN).
  - The app reads the first page's `override`: `null` clears a stored verifier; absent keeps it.
- Keyset pagination ordered by `id`; loop until `next_after` is null. `no-store, private`.
- `since` returns only tickets created/checked-in after the time and does **not** reflect later cancellations/refunds → do a full refresh periodically.
- Auth: event owner, or scanner active in **both** `event_scanners` and `vendor_scanners`. Errors: 403 `forbidden`, 404 `not_found`, 400 bad param, 503 `roster_failed`.
- Guest bookings usually have `holder_name = null` → lookup by phone digits.
- **Verified 2026-10-07 (`c8fe25e8`):** `scanned_by` is the scanner's name or null; `by_me` is null when the ticket isn't checked in. Tickets of **every** booking status are returned (`pending|confirmed|completed|cancelled`; refunds become `cancelled`) and only `confirmed` admits; `event.total`/`admitted` include non-confirmed tickets. `since` means `created_at > since OR checked_in_at > since`. Unknown event → 403; non-UUID event id → 404 with no `code`. Timestamps carry microseconds.

**Batch** `POST /api/events/{id}/scan/batch`

- Request `{device_id (8–64 chars [A-Za-z0-9_-]), items:[{client_seq (int ≥0, unique), ticket_id (uuid or BH1/BH2, ≤400 chars), scanned_at (ISO), mode:"offline"|"offline_override"|"manual_lookup", reason? (≤200), approved_by? (≤80)}]}`; 1–200 items. `offline_override` needs `reason` (≥3 chars) and `approved_by`.
- Response 200 `{results:[{client_seq, ok, code, replayed, …}]}`, `no-store`. `ok` → `ticket, checked_in_at (backdated to client time), booking:{id,total_tickets,checked_in_count}`. `already_checked_in` → `ticket, checked_in_at, scanned_by (name), by_me`.
- Item codes: `ok, already_checked_in, not_found, forbidden, wrong_event, not_confirmed, static_not_allowed, booking_qr, bad_timestamp, expired_code, invalid_code, bad_item`.
- Idempotent on `(user, device_id, listing, client_seq)`; replay returns stored result with `replayed:true`. `scanned_at` clamped to ≥30 days ago; >5 min in the future → `bad_timestamp`. 503 `sync_failed` → keep the queue and retry.
- **Verified 2026-10-07 (`c8fe25e8`):** only `ok` and `already_checked_in` carry extra fields: an `ok` ticket is `{id, ticket_type, ticket_index, seat}`; `already_checked_in` has `scanned_by` never null and `by_me` a boolean. A replay ignores the new item's content. `scanned_at` up to 5 min in the future is clamped to now. `ticket_id` must be a UUID or a BH1/BH2 code (not a URL). `static_not_allowed` occurs only for mode `offline` with a bare UUID. 401 and a malformed-id 404 have no `code`.
- BH1 is admitted in batch only if the HMAC verifies server-side; `offline_override`/`manual_lookup` skip the liveness proof and are logged with mode/reason/approver.

**Customer code** `GET /api/tickets/{ticketId}/code` → `{token, format(1|2), expires_at(ms), step_seconds, ticket}`. 401; 403 not holder (guest bookings have no `customer_id`); 404; 409 not confirmed / already used; 503.

**Keys** `GET /api/ticket-keys` (no auth) → `{alg:"Ed25519", format:2, step_seconds:30, keys:[{kid, publicKey (raw 32B base64url), signing}]}`. Empty `keys` = BH2 not set up; 503 = retry. Cached 60 s. **Verified 2026-10-07:** this route is on the `public` rate tier (60/min per IP), so mobile refreshes keys from the roster's first page instead of calling it.

**Scannable events (web PR #192, on `main`):** `GET /api/events/scannable` (Bearer, `gate` tier, `Cache-Control: no-store`) → 200 `{events:[{id, title, location, event_date, event_time, event_end_date, visibility, active, require_dynamic_ticket, role:"owner"|"scanner"}]}`, soonest first, includes draft and private listings. Errors: 401 `{code:"unauthorized"}`, 503 `{code:"events_failed"}` with `Retry-After: 5`. The rule matches `admit_ticket` (owner, or active `event_scanners` AND active `vendor_scanners`). Mobile should call this route rather than reproduce it under RLS. Note: it can return **owner** entries, but mobile keeps vendors `webOnly` (MOBILE_APP_REQUIREMENTS §2.1), so those entries are unreachable from the app until that decision changes.

**Gap (historical, before PR #192; superseded by `/api/events/scannable` above):** "events I can scan" is a server action (`getMyScannableEvents`, `lib/eventscanners.js`, which uses the admin client and no `vendor_scanners` check). Mobile can reproduce it under RLS: own active `event_scanners` with the listing embedded, intersected with own active `vendor_scanners` on `listings.vendor_id`. Scanners cannot read draft/private listings or listings of suspended vendors (the embed comes back `null`), though the web page still lists them. For those rows, `rpc('is_listing_scanner', {p_listing_id, p_user_id})` (granted to `authenticated`) is the authoritative check. Past and inactive public listings remain readable. UNVERIFIED with a Bearer token against production until Phase 1 tests it.

## 4. Receptionist contracts

- **Check-in** `POST /api/bookings/hotel/checkin` `{booking_id}` or `{code (≤32)}`; `booking_id` wins. Allowed: admin, owning vendor, receptionist assigned to that hotel. 200 `{success, warning?, booking:{id,guest_name,check_in_date,check_out_date,hotel_name}}`. Errors `{error, code}`: `bad_request` 400, `cancelled` 400, `not_paid` 400, `forbidden` 403, `not_found` 404, `already_checked_in` 409 (+`checked_in_at`,`guest_name`), `room_occupied` 409 (+`room_number`), `check_in_failed` 500, `unexpected` 500. Paid = `completed | paid | pay_at_hotel`.
- **Preview** `GET /api/bookings/hotel/checkin?code=` → `{booking}` (includes guest email/phone); 403/404/400/500.
- **Checkout** `POST /api/bookings/hotel/checkout` `{booking_id}` → codes `already_checked_out` 409, `not_checked_in` 400, `not_found`, `forbidden`, `bad_request`.
- **Room status** `PATCH /api/hotel/rooms/{roomId}/status`; 409 when occupied.

## 5. Payments

- `POST /api/payment/initialize` `{requestId, requestType: logistics|security|hotel|apartment|event, amount, currency="NGN", email, provider:"paystack"|"crypto", payCurrency (required for crypto), metadata}` → `{success, payment:{id, reference, provider, amount, base_amount, service_charge_amount, service_charge_label, currency, payment_url, access_code, order_id, invoice_id, pay_currency}, message}`. Server recomputes price. Crypto `payment_url` is the hosted NOWPayments invoice.
- `callback_url` = `${NEXT_PUBLIC_BASE_URL}payment/callback?reference=…&provider=…` (a web page; **no app return exists**). Note: built without a slash, so the env value must end in `/`.
- Status: `GET /api/payment/status/{reference}` → `{payment:{id, reference, amount, currency, status, paid_at, channel, fulfilled, created_at, metadata, request_type}, request}`. `status` is the raw DB value (crypto: `waiting|confirming|sending|partially_paid|expired|failed|finished`). No explicit auth check — relies on RLS; verify a bearer client can poll it. Also `/verify`, `/check-status`, `/reconcile`.

## 6. Auth / signup (native auth, web PR #206, merged to `main` as `30c7da90` on 2026-10-08; production deploy UNVERIFIED)

Contract doc: web `docs/mobile/NATIVE_AUTH_API.md`; code-verified on `origin/main` @ `30c7da90` (nothing run against production). All routes are on the apex, JSON, errors `{error, code}`; branch on `code`. Route responses are `no-store`; proxy-generated 429/503 are not.

- **Login:** unchanged. `supabase.auth.signInWithPassword` directly (not behind the web proxy or its limiter). Unconfirmed email fails with "Email not confirmed" (code `email_not_confirmed`, UNVERIFIED): offer "Send code" (resend-confirmation), then the code screen. A deleted (banned) account fails with `user_banned` (web probe, UNVERIFIED in code).
- **Sign-up** `POST /api/auth/signup` (anon, `auth` tier). Body `{name (1–100 after trim), email (≤254, trimmed and lowercased), password, coords?:{lat,lng}}`; the role is always customer. Password: ≥8 chars, ≤72 UTF-8 bytes, upper, lower, digit, one of `@$!%*?&`.
  - 201 `{ok, user:{id,email}, verification:"otp"}`. No session. The `users` row, wallet and admin notice exist already; an email send failure does not fail the sign-up.
  - 400 `invalid_input` (`fields` optional; can include `password`).
  - 409 `email_taken` (also for an existing **unconfirmed** account: offer Resend).
  - 422 `weak_password` (`fields.password` = failed rule ids or `too_long`; absent when Supabase's own policy refused).
  - 503 `unavailable` (Supabase sign-ups off or email rate limit); 500 `signup_failed`.
  - Not idempotent: a retry after a lost 201 gets 409 — treat it as "probably created" and go to the code screen.
- **Verify:** `supabase.auth.verifyOtp({email, token, type:"signup"})` returns the session. Use the normalised `user.email` from the 201. The code is 6 digits (web probe; validate `^\d{6,10}$`). Emails say it expires in 1 hour (`mailer_otp_exp` UNVERIFIED). Code and link share one token; only the newest email's code works. The code is in the email subject (iOS autofill).
- **Resend** `POST /api/auth/resend-confirmation {email}` (anon, `auth`): always 202 `{ok:true}`; 400 `invalid_input` if malformed. Sends only to an existing unconfirmed account and invalidates the previous code. This is the only way a web-registered user gets a code (web emails carry the link only).
- **Forgot** `POST /api/auth/forgot-password {email}` (anon, `auth`): always 202; 400 if malformed. Resend = call it again. Then `verifyOtp({email, token, type:"recovery"})` gives a signed-in session. Whether recovery reaches an unconfirmed account, or confirms the email, is UNVERIFIED.
- **Reset** `POST /api/auth/reset-password {password}` (Bearer, network-checked, `auth` tier): 200 `{ok}`; 401 `unauthorized`; 422 `weak_password` (`fields.password`; `"policy"` when Supabase refused; also for a missing body); 500 `update_failed`. Never `updateUser({password})` (bypasses the server rules). Other sessions are probably not revoked (UNVERIFIED).
- **Rate limits:** the `auth` tier is 5/60 s **per IP**, one bucket shared by all four routes above and web's `/login`, `/register`, `/forgot-password` and `/reset-password` POSTs. It fails **closed**: 503 `{error}` with **no `code`**, `Retry-After: 30` — treat as transient, not as signup's `503 unavailable`. The 429 is `{error, code:"rate_limited", retry_after}` + `Retry-After`. `verifyOtp` and `signInWithPassword` are not behind this limiter.
- **Headers:** `X-App-Version` and `X-Platform` are not read by any route. Nothing in the backend tells app requests apart from web ones: the JSON routes always email a code, web's Server Actions never do.
- **Staging:** none of these routes is on the staging Basic-auth allowlist (§8).
- Never `supabase.auth.signUp` (still possible with the anon key; creates an auth user with no `users` row or wallet).

### 6a. Account deletion

- `POST /api/account/delete` (Bearer, network-checked; `user` tier, 30/60 s **per IP**, fails open). Body `{confirm:"DELETE", password?}`. The app does **not** send `password`; it checks it with `signInWithPassword` first.
  - 200 `{ok, status:"deleted"}` (never `"scheduled"`)
  - 400 `confirmation_required`
  - 401 `unauthorized` | `invalid_password` (branch on `code`; **any** server-side `signInWithPassword` error, including a Supabase rate limit, reads as `invalid_password`)
  - 403 `not_customer` (receptionists, vendors, admins; gate staff carry role `customer` and **can** delete)
  - 409 `has_active_bookings` | `has_wallet_balance` | `open_dispute` with `detail` and `blockers[]` (show `detail`)
  - 500 `delete_failed` (safe to retry)
- Blockers: a confirmed or checked-in hotel/apartment booking with check-out ≥ today (Lagos), a confirmed event booking dated ≥ today, wallet balance > 0, an open or under-review dispute raised by the user. Pending/unpaid bookings don't block.
- Re-auth: optional password only. No OTP or recency check.
- Effect: anonymise, not delete. `users` PII is scrubbed and the email becomes `deleted-<id>@deleted.invalid` (the address can be registered again); push subscriptions, saved listings, follows, waitlist and notifications are removed; `event_scanners` deactivated, wallet closed; the auth user is renamed, given a random password and banned for ~100 years. Bookings, payments, wallet transactions and reviews are kept.
- After a 200: `signOut({scope:"local"})` and wipe SecureStore, caches and the encrypted roster/outbox (a gate outbox can never sync again — warn first if it isn't empty). The old access token still passes locally-verified routes until it expires.
- A retry after a lost 200 gets 401 `unauthorized` (the user is banned): on that, `refreshSession()`; `user_banned` means it was deleted.
- Public page for Play/App Store: `https://bookhushly.com/account/delete`.

## 7. Customer API gaps

| Flow                                          | State                                                                                                                                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hotel booking                                 | **Server action only** (`bookHotelRoomAction` → `book_hotel_room` RPC). `POST /api/bookings/hotel` only sends a notification.                                                                                                                                              |
| Apartment booking                             | `POST /api/bookings/apartment` exists but multipart + admin client.                                                                                                                                                                                                        |
| Event booking                                 | HTTP routes exist (see §2.4).                                                                                                                                                                                                                                              |
| My bookings                                   | No list route — server actions / direct RLS reads.                                                                                                                                                                                                                         |
| Trips, messages, KYC submit                   | Server actions. `GET /api/customer/kyc` exists.                                                                                                                                                                                                                            |
| Saved listings, reviews, organizers, waitlist | HTTP routes exist.                                                                                                                                                                                                                                                         |
| Listings                                      | `GET /api/listings?category=…` (required): `page` (0-based, 20/page), `search, sort, city, state, price_min, price_max, min_rating` + per-category filters. → `{items, nextPage?, totalCount \| null}`. Anonymous; `s-maxage=30`. `GET /api/listings/{id}`, `/lock` exist. |

## 8. Risks

- **Staging blocks Bearer.** `proxy.js` rejects non-Basic `Authorization` on any deploy with `STAGING_BASIC_AUTH_*` set (except allowlisted paths like `/api/health`, `/api/payment-callback`). Mobile against staging needs a path exemption or separate gate.
- **Revocation:** local JWT verification means a revoked/deleted user's token works until expiry (`getVerifiedUser` unused; audit §1.8) — also on the batch route.
- `docs/PRELAUNCH_AUDIT.md` (2026-08-17) in web lists open P0s; read it before relying on any route's guard. Hotel bookings have no concurrency lock; `GET /api/bookings/apartment/[id]` does `select *` without an explicit auth check.
- The web DB is live production with test-mode payment keys. **No destructive tests**; provision test accounts through real flows.

## 9. Web-side work to request (not mobile work)

Hotel-booking JSON route · apartment booking JSON · my-bookings route · scannable-events route · universal links + AASA/assetlinks + app return for payments · native push (REQ-5) · claim-by-email (REQ-11) · min-version/maintenance endpoint · staging Bearer exemption · confirm `TICKET_TOKEN_FORMAT=2` + keys in production.

- **Gate scanning (Phase 1, 2026-10-05): all four asked for are implemented on web branch `feat/mobile-scan-api-tweaks` (PR #192).** Merged to web `main` as `826a2736` (PR #192). **Live on production** (probe 2026-10-07, signed out; the 2026-10-05 probe still got 404): `GET /api/events/scannable`, `GET …/scan/summary` and `POST …/scan` all return 401 `{error, code:"unauthorized"}`. The 429 shape with `Retry-After` and the authenticated bodies are not yet checked on production; verify with the QA account in Phase 1 device testing. Remaining gap: `/api/events/scannable` returns owner entries that mobile can't use while vendors are `webOnly`.
- **Native auth (2026-10-08): delivered in web PR #206 (`30c7da90` on `main`); see §6 and §6a.** Asks 0–5 from `docs/mobile/NATIVE_AUTH_ASKS.md` are done, including the P0: `signup` now forces the role and the server enforces the password rules. Ask 6 (universal links) was deferred to the payment-return work. Still open on web:
  (a) the owner must confirm `mailer_otp_exp` (emails say 1 hour) and which Send Email hook is live;
  (b) raw anon `supabase.auth.signUp` still works and creates an orphan auth user (no `users` row or wallet); closing it needs "Allow new users to sign up" off, untested;
  (c) `/api/account/delete` maps any server-side password-check error (including a Supabase rate limit or outage) to 401 `invalid_password`. Ask for a separate transient (503) code for a failed check. Mobile sidesteps it by checking the password client-side and never sending it;
  (d) `X-App-Version` / `X-Platform` are not read; the min-version/maintenance endpoint is still open;
  (e) the `auth` tier is one 5/min IP bucket across signup/resend/forgot/reset and the web auth pages, which is tight for carrier-grade NAT (shared mobile IPs). Ask whether it can be keyed per IP+email or relaxed for resend/forgot;
  (f) staging allowlist/Bearer exemption for the auth routes;
  (g) whether recovery reaches an unconfirmed account and whether verifying a recovery code confirms the email (Supabase behaviour, unverified);
  (h) confirm PR #206 is deployed to production (probe `POST /api/auth/forgot-password` with a malformed email, expect 400 `invalid_input`).
- **Roster `since` misses backdated admissions (found 2026-10-07).** `admit_tickets_batch` backdates `checked_in_at` to the device's `scanned_at`, but roster `since` filters on `checked_in_at > since`, so another phone's offline admissions synced after this phone's mark are missed by deltas until the 30-min full refresh (cross-door double-admit window). Request: filter `since` on a synced/updated-at column.

## 10. Verified during Phase 0 (2026-10-04)

- `GET /api/customer/kyc` (Bearer works; `public` rate tier, 60/min/IP): 200 `{ kyc: null | { id, status: 'verified'|'rejected'|'pending', submitted_at, admin_note: string|null, nin_verified: boolean } }`; **401 body is `{ status: null }`** (no `error`/`code` — branch on the HTTP status); **a DB failure also returns 200 `{ kyc: null }`**, indistinguishable from "no KYC"; no `Cache-Control`. The column default `status='verified'` looks odd (insert path not read).
- `GET /api/health` (public, no staging Basic-auth wall): 200 `{ ok: true, db: 'up', ts }`; 503 `{ ok: false, db: 'down', ts }`; `no-store`.
- Mode resolution reads (RLS, verified in the baseline migration): `users` select own, `hotel_staff` (`hotel_staff_read_own`), `event_scanners` (`event_scanners_self_select`), `vendor_scanners` (`vendor_scanners_self_select`, baseline:11151). Scan and roster also need an active `vendor_scanners` row for the listing's vendor. Mobile can read it, so the gate-mode count checks both tables (corrected 2026-10-05; the earlier note that mobile could not see `vendor_scanners` was wrong).
- Production Supabase issues the **legacy anon JWT** key (`role: anon`), not a publishable key.
- Still missing on the backend (see §9): universal links, min-version endpoint, staging Bearer exemption, scannable-events route. (Sign-up/forgot-password routes landed 2026-10-08, see §6.)
- **2026-10-05, verified with the QA customer account against production:** Bearer `GET https://bookhushly.com/api/customer/kyc` → 200 `{kyc:null}`; without Bearer → 401 `{status:null}`; via `www.` → 308 → header dropped → 401. RLS reads for mode resolution work (`users` own row, `hotel_staff` null, `event_scanners` 0 rows). **`/api/health` returns 404 on production** — production is deployed from a commit older than web `main` (health landed 2026-10-04); don't depend on routes newer than the live deploy without checking.

- **Phase 2a (2026-10-07): offline scanning built — device verification pending (see plan Task 17 step 6).**
- **Phase 2b (2026-10-07): lookup, override PIN, activity/export and shift summary built — device verification pending.**
