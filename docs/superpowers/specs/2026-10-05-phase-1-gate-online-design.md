# Phase 1 — Gate staff, online scanning (design)

**Status:** approved in conversation 2026-10-05 · **Branch:** `feat/phase-1-gate-online` · **Requirements:** FR-3.1–3.3, FR-3.9–3.13, FR-3.17, acceptance §11.2 scenarios 1–8. Offline (FR-3.4–3.8, 3.14–3.15) is Phase 2.

## 1. Goal and success

A gate-staff member signs in, picks an event they are assigned to, and scans tickets at the door. Every scan ends in exactly one of four outcomes: **Admitted · Already used · Refused (reason) · Couldn't check — try again.** Online only.

Done when scenarios 1–8 pass on the Moto G06 (EAS preview build) and the outcome is on screen < 100 ms after the server answers.

## 2. Decisions (from the docs and the 2026-10-05 web read)

1. **Vendors stay `webOnly`** (requirements §2.1: vendors out of scope for v1). Gate mode = assigned scanner accounts only; "owned events" in FR-3.1 does not apply.
2. **Gate eligibility = active `event_scanners` row AND active `vendor_scanners` row for that listing's vendor** — the server's rule (`admit_ticket`). Fixes the Phase 0 mode count, which looked at `event_scanners` only. Mobile can read its own `vendor_scanners` rows (`vendor_scanners_self_select`); BACKEND_STATUS §10 is corrected.
3. **Do not copy the web outcome mapping**: web shows 401/403/429/503/network as "Do not admit". Mobile maps every transient failure to _Couldn't check_.
4. **`by_me` is missing on the online scan route**: an `already_checked_in` that follows a timed-out/network-failed attempt of the same code is shown as "Already used — by you, just now".
5. **A held overlay (refusal / couldn't check) is never replaced** by a later result (web bug).
6. **Hidden listings** (draft/private/suspended vendor) are unreadable by scanners; they are shown as "Event · <short id>" when the server's `is_listing_scanner` confirms access. The scan route does not check visibility.
7. **Test setup:** the owner creates a clearly named public test event with 2–3 free tickets, a scanner via the web roster UI, and the QA customer books them; removed/deactivated after testing. Until then, build against unit tests + contract fixtures.

## 3. Screens and flow (`src/app/(gate)/`)

| Route             | Screen                                                                                                                                                                                                                                                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/gate`           | **Event list** — assigned events, upcoming first (soonest first), past in a collapsed "Earlier" group; row = title, date/time, venue. Remembers the last event per device and auto-opens it if still listed. Empty: "No events assigned — ask the organiser." + sign out. Pull to refresh. Sign out + mode switcher in the header.                                  |
| `/gate/[eventId]` | **Scanner** — top bar: title, door counter `admitted / total`, sound toggle. Middle: live camera with viewfinder brackets, no idle animation. Bottom third (≥ 56 pt): torch, "Enter code", "Recent". Keep-awake while open; camera unmounted when unfocused. Permission denied → explanation card + "Open settings"; manual entry still works. "Change event" link. |
| sheet             | **Enter code** — UUID or pasted link, same parser; invalid input rejected inline, no network call.                                                                                                                                                                                                                                                                  |
| sheet             | **Recent** — last 50 admissions from the summary, "by me" marker.                                                                                                                                                                                                                                                                                                   |

**Outcome overlay** (full-screen solid fill + large icon + one word + detail; DESIGN_SYSTEM D9 stops; no Lottie, no entrance animation):

| Outcome                                                 | Fill                      | Detail                                                                  | Hold                                                     |
| ------------------------------------------------------- | ------------------------- | ----------------------------------------------------------------------- | -------------------------------------------------------- |
| Admitted                                                | green `#166534`           | ticket type + "ticket 2 of 3", booking checked-in progress              | 1.6 s                                                    |
| Already used                                            | amber `#FBBF24`, ink text | when + by whom / "by you" / "another scanner"                           | 3.2 s                                                    |
| Refused                                                 | red `#991B1B`             | specific reason                                                         | until "Done"                                             |
| Refused, fixable (`expired_code`, `static_not_allowed`) | amber                     | "Ask them to refresh their ticket" / "Ask for the live ticket"          | until "Done"                                             |
| Couldn't check                                          | neutral (never red)       | "We couldn't reach the server — scan again" (+ "Sign in again" on auth) | until dismissed; big "Try again" resubmits the same code |

Results arriving while an overlay is up wait in order. Audio + haptic fire when each overlay appears. No undo anywhere (FR-3.13).

## 4. Scan engine (`src/features/gate/domain/`, pure TS, no React)

- **`parseTicketCode(raw)`** → `{kind:'rotating', value}` | `{kind:'static', ticketId}` | `null`. Mirrors web `lib/scan/parse-code.js`: trimmed; `^BH[12]\.` passes through untouched; otherwise the first UUID (`/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i`) is extracted; > 400 chars → `null`.
- **`classify(result, ctx)`** → `ScanOutcome`:
  - `200` → `admitted {ticket, booking}`
  - `409 already_checked_in` → `used {checkedInAt, scannedBy, byMe}`; `byMe = ctx.priorAttemptUncertain`; `scannedBy` that looks like an email → shown as "another scanner".
  - `404 not_found`, `409 booking_qr | wrong_event | not_confirmed`, `400/409 invalid_code` → `refused {reason, fixable:false}`
  - `409 expired_code | static_not_allowed` → `refused {reason, fixable:true}`
  - `403 forbidden` → `refused {reason:'notAssigned'}` — scanner-side problem; copy says call the organiser; never remembered as settled.
  - 401 (after the client's one refresh) → `couldntCheck {cause:'auth'}`
  - 429, 5xx, timeout, network, unparseable body → `couldntCheck {cause}`
- **`createScanQueue({submit, now, random})`**: concurrency 3; up to 2 retries for transient failures only (network, timeout, 429, 5xx) with `400 ms × attempt` + jitter. The scan POST is not idempotent, so the API client does not retry it; the queue owns retries so it knows when a prior attempt may have committed (→ `priorAttemptUncertain`). De-dupe key = parsed code; in-flight duplicates ignored. Settled (`admitted`/`used`) remembered (cap 5000, oldest evicted) and replayed instantly as "Already used (this phone)" without a call. Fixable refusals, `notAssigned` and `couldntCheck` are never remembered. A 2 s per-code cooldown after a result absorbs repeat camera callbacks. `reset()` on event switch. Emits `onResult(code, outcome)`.
- **`createOverlayQueue({now})`**: FIFO with hold times above; `current`, `push`, `dismiss`, `tick`. A held overlay is never replaced. With > 3 waiting, queued admitted results collapse into a "+N admitted" chip on the next overlay so a run of greens can't bury a red.
- **Glue (`hooks/useScanSession(eventId)`)**: wires the queue to `api.post('/api/events/{id}/scan', {ticket_id})` with ~8 s timeout and `retry: false`, and to the overlay queue; exposes state through a small Zustand store; invalidates the summary query after each admission. Phase 2 swaps `submit` for roster + outbox; classify/queue/overlay are unchanged.

## 5. Data, errors and edge cases

- **`api/loadScannableEvents(db, userId)`** (DI like `loadModeInputs`), RLS-only: own active `event_scanners` with the listing embedded (`id, title, event_date, event_time, location, vendor_id`) + own active `vendor_scanners`; keep a row if the listing's `vendor_id` is in the active vendor set; for rows whose listing is `null` (hidden), keep it only if `rpc('is_listing_scanner')` returns true. zod-parsed. **Verify the embed and the RPC with Bearer against production before relying on them.** Mode resolution's scanner count uses the same rule.
- **Summary** `GET /api/events/{id}/scan/summary` → `{admitted, total, recent:[{id, ticket_type, checked_in_at, scanned_by_me}]}`: TanStack query, 15 s polling while focused, invalidated after admission. "—" before the first answer; on later failure keep the last value with a quiet "not updated" marker.
- **Event id** must be a UUID (a non-UUID returns 503 from the server) — otherwise route back to the list.
- Code that doesn't parse → immediate local "Refused — not a Bookhushly ticket", no request.
- The camera never stops for a failed request; the overlay queue absorbs results.
- Session expiry mid-shift → `couldntCheck` with "Sign in again"; settled memory survives re-sign-in for the same event.
- Backgrounding unmounts the camera; in-flight requests complete and their results show on return.
- 403 mid-shift → "You aren't assigned to this event" + back to the list.
- **Feedback** (`src/shared/platform/feedback.ts`): four short bundled sounds via `expo-audio`, preloaded, `playsInSilentMode: false`; haptics success / warning / error / light per outcome; mute persisted in KV. iOS haptics may be silent while the camera runs — colour + icon + text + sound carry the result.
- **PII:** the scan response's `booking.contact_email` / `contact_phone` are stripped by the zod schema and never shown or logged. Sentry breadcrumbs carry outcome kind, latency and status only — no codes or ticket ids.

## 6. Dependencies

`npx expo install expo-camera expo-keep-awake expo-haptics expo-audio` → new EAS dev/preview build. expo-camera plugin: `cameraPermission` text, `recordAudioAndroid: false`, no microphone permission. Android decoding uses bundled ML Kit (no network); do not use `launchScanner()` (Play Services module download). `active` is iOS-only, so unmount on blur.

## 7. Testing and verification

- **TDD unit tests:** `parseTicketCode` (web cases + BH2, URLs, whitespace, length); `classify` (every contract row; 429/503 → couldntCheck; timeout-then-used → `byMe`; email `scannedBy`); scan queue with a fake clock (concurrency 3, in-flight de-dupe, settled replay without submit, transient-only retry with backoff, eviction at 5000, 2 s cooldown, reset); overlay queue (holds, no replacement of held, "+N admitted"); `loadScannableEvents` (vendor intersection, hidden listings, error mapping); mode count fix.
- **Component tests (RNTL v14, async):** event list empty state + auto-open; overlay colour + icon + text per outcome; enter-code validation; permission-denied card. Camera mocked.
- **Contract fixtures:** response JSON per contract row beside the zod schemas.
- **Gates:** tsc, eslint, prettier, jest clean; reviews by rn-code-reviewer, offline-scan-reviewer, ux-design-reviewer, mobile-security-reviewer, perf-auditor.
- **On device (Moto G06):** scenarios 1–8 with the owner's test event; outcome latency < 100 ms after response; no dropped frames on the idle camera; 10-minute continuous scan without heat or memory growth.

## 8. Doc updates in this phase

- `docs/BACKEND_STATUS.md` §3/§10: corrected scan status map (`invalid_code` 409 rotating / 400 static; refusal extras; `scanned_by` may be an email; no `by_me`), rate tier `gate` 1200/60 s per user shared across scan routes, 429 without `code`/`Retry-After`, exact summary shape and code-less errors, `vendor_scanners` readable, scannable-events RLS recipe.
- `docs/BACKEND_STATUS.md` §9 (web asks): `by_me` on the online scan route; stop returning a scanner's email in `scanned_by`; `code` on 429 and summary errors; `Retry-After` on 429; a scannable-events route that includes hidden listings.
