# Phase 2a — Gate staff, offline core loop (design)

**Status:** approved in conversation 2026-10-07 · **Branch:** `feat/phase-2a-gate-offline` · **Requirements:** FR-3.4–3.6, FR-3.9–3.12 (offline parts), §8.2–8.6, NFR-1.2 (offline ≤ 150 ms), NFR-1.5, NFR-2.1, NFR-3.3, NFR-3.10, acceptance §11.2 scenarios 9–12, 14, 15, 15a–15c, 15e.

**Out of scope (Phase 2b):** name / phone-digit roster lookup (FR-3.7, `manual_lookup`), group context (FR-3.8), supervisor override PIN (FR-3.15, scenarios 13, 15d), outbox view + CSV export (FR-3.14), shift summary (FR-3.16).

## 1. Goal and success

When the network drops at the door, scanning keeps working: the phone decides on its own from a downloaded, encrypted roster, records every offline admission durably before showing it, and syncs it to the server when the connection returns. Staff always see whether they are online, how fresh the offline list is, and how many admissions are waiting to sync. No admission is ever lost silently.

Done when, on the Moto G06 (EAS preview build): a 50k-ticket roster downloads and resumes after interruption; airplane-mode scans decide in < 150 ms; scenarios 9–12, 14, 15, 15a–15c, 15e pass; killing the app mid-sync loses nothing.

## 2. Decisions

1. **Online first, offline on failure.** With a roster present and the network up, scans still go through the Phase 1 live path; the server stays the source of truth. A scan falls back to the local decision only when the live call cannot complete (network, timeout, 5xx), after Phase 1's transient retries are spent.
2. **Degraded state.** After **2 consecutive transient failures**, or when `expo-network` reports no connection, the session is *degraded*: new scans go straight to the local decision (no 6 s wait per scan) and one probe request every 15 s checks whether the server is back. The first successful live call leaves degraded.
3. **429 is not a fallback.** The server is reachable, so 429 stays *Couldn't check*. A server refusal with a code is never overridden by the local roster.
4. **Roster downloads automatically** when the scanner opens an event, then refreshes in the foreground: delta (`since`) every 3 min, full refresh every 30 min (deltas miss cancellations/refunds), plus a manual "Refresh list". No background tasks in 2a.
5. **Unknown `kid` and BH1 are *Couldn't check*, not refusals**: a new key may be a legitimate rotation, and a BH1 code may be valid — the phone just can't verify it. Bad signature / malformed BH2 is *Refused*.
6. **Outbox items are kept after sync** (state `synced`) as the shift log; they are removed only by the wipe.
7. **Online results also update the local roster**, so a ticket admitted online is *Already used* if the signal drops minutes later.

## 3. Architecture

Pure logic is free of React/Expo and unit-tested under Jest; storage sits behind an interface with an in-memory fake for tests.

| Unit | Where | Job |
|---|---|---|
| `bh2.ts` | `src/features/gate/domain/` | Parse `BH2.<kid>.<id>.<step>.<sig>` (BACKEND_STATUS §2.1), verify Ed25519 over `bh2:<kid>:<uuid lowercase dashed>:<step>` with `@noble/curves` (strictness must match the web's `lib/ticket-tokens.js`), check step ±1 against a supplied `now`. Returns `ok | malformed | unknown_key | bad_signature | expired` plus the ticket UUID. |
| `offlineDecide.ts` | `src/features/gate/domain/` | Pure `(parsed code, roster row, booking hit, outbox hit, event rules, keys, clock state, now) → outcome` implementing §4. |
| `clockGuard.ts` | `src/shared/lib/` | Extends `clock.ts`: stores the server offset with its age; flags the clock **suspect** (§5). |
| `db.ts` | `src/shared/db/` | `expo-sqlite` + SQLCipher (`PRAGMA key` right after open), random 32-byte key from `expo-crypto` in SecureStore, WAL, `PRAGMA user_version` migrations. |
| `rosterStore.ts`, `outboxStore.ts` | `src/features/gate/offline/` | Repository interfaces + SQLite implementations + in-memory fakes. |
| `rosterSync.ts` | `src/features/gate/offline/` | Pages of ≤ 2000 via `GET /api/events/{id}/scan/roster`, one transaction per page, cursor persisted so an interrupted download resumes. Full refresh writes into a staging table and swaps in one transaction; scanning uses the old roster until then. First page stores `keys`, `require_dynamic_ticket`, totals, `server_time`. |
| `batchSync.ts` | `src/features/gate/offline/` | `POST /api/events/{id}/scan/batch`, oldest first, ≤ 200 items, reconciles per §6. |
| scan routing | `scanQueue` / `useScanSession` | Phase 1 queue unchanged except: a transient failure with retries spent → `offlineDecide` when a usable roster exists; degraded state (§2.2) routes new scans straight to it. |

**Tables:** `roster_ticket` (event_id, id, ticket_type, ticket_index, booking_id, booking_status, checked_in_at, scanned_by, by_me, holder_name, phone_masked, seat; indexes on `(event_id, id)` and `(event_id, booking_id)`), `roster_meta` (event_id, keys JSON, require_dynamic_ticket, total, cursor, last_delta_at, last_full_at, event end), `outbox` (§6), `device` (device_id, next client_seq). Roster fields are exactly what the endpoint returns — name + masked phone only (DECISION-8); no email or full phone is ever stored.

**Write-ahead:** an offline admission writes the roster row's `checked_in_at` and appends the outbox item in **one transaction**; the success overlay is shown only after commit.

## 4. Offline decision table

First matching rule wins.

| # | Situation | Outcome | Staff see |
|---|---|---|---|
| 1 | Code doesn't parse | Refused | "Not a Bookhushly ticket" |
| 2 | BH2 malformed / bad signature | Refused | "Invalid ticket code" |
| 3 | BH2 unknown `kid` | Couldn't check | "Phone's key list is out of date — refresh when online" (when online, keys are refreshed once first) |
| 4 | BH2 and clock suspect | Couldn't check | "Phone time changed — connect once to re-check" |
| 5 | BH2 step outside ±1 of the corrected clock | Refused (fixable, amber) | "Code expired — ask them to reopen their ticket" |
| 6 | BH1 code | Couldn't check | "Can't verify this code offline — ask them to reopen the ticket online"; never admitted on ID alone |
| 7 | Static UUID on a `require_dynamic_ticket` event | Refused (fixable, amber) | "Ask for the live ticket" |
| 8 | UUID matches a roster `booking_id`, not a ticket | Refused | "This is a booking code — scan the individual ticket" |
| 9 | Not in roster | Refused | "Not in offline list (updated 4 min ago)" |
| 10 | Booking not confirmed | Refused | "Booking not confirmed" |
| 11 | Already admitted (roster `checked_in_at` or an outbox item from this phone) | Already used | Time + "by you" / scanner name from roster |
| 12 | Otherwise | **Admitted (offline)** | Green overlay + "Offline · will sync" tag |

No usable roster (never downloaded, or expired) → the Phase 1 *Couldn't check* behaviour, with "No offline list on this phone".

## 5. Clock integrity

- The offset is taken from the server `Date` header on every successful request (existing `clock.ts`), persisted with its timestamp.
- **Suspect** when, within a session, the wall clock jumps > 2 min relative to the monotonic clock, or the corrected time is earlier than the last server contact.
- **Known gap:** a clock change made while the app was closed, with no server contact since, can't be detected (monotonic time restarts with the app; a boot clock is to be verified, §8). Mitigations: when the offset is > 12 h old the sync bar shows "Time last checked 14 h ago"; the batch sync re-verifies BH2 server-side, and an out-of-window step comes back `expired_code` → flagged **suspect** (§6).
- Rules 7–12 never depend on the clock and keep working when it is suspect.

## 6. Outbox and batch sync

**Item:** `client_seq`, `device_id`, `event_id`, `code` (the original scanned string, so the server re-verifies BH2), `scanned_at` (corrected clock, ISO), `mode: "offline"`, `kid`, `app_version`, `state`, `attempts`, `next_try_at`, `result` (JSON). `client_seq` increments in the same transaction; `device_id` is random, generated once per install.

**States:** `pending → sending → synced | duplicate | suspect | rejected | blocked | error`. A `sending` item found at startup returns to `pending` (the endpoint is idempotent on `(user, device_id, listing, client_seq)`, so resending is safe).

| Response | Effect |
|---|---|
| item `ok`, or `already_checked_in` with `by_me: true` | `synced` |
| item `already_checked_in`, not by me | `duplicate` (both times, other scanner's name) |
| item `invalid_code` / `expired_code` | `suspect` |
| item `not_found`, `wrong_event`, `not_confirmed`, `static_not_allowed`, `bad_timestamp`, `booking_qr`, `bad_item`, `forbidden` | `rejected` with the code |
| whole-request 403 | all the event's unsynced items → `blocked`; sync stops; "Removed from this event — the organiser has these admissions on record" |
| 401 | refresh session once, retry |
| 429, 503, network, timeout | back off 2 s doubling to 60 s with jitter |
| whole-request 400 | items → `error`, reported to Sentry (scrubbed), no loop |

**Triggers:** connection returns, every 30 s while items are pending, "Sync now". Foreground only.

## 7. UI

- **Sync bar** on the scanner, always visible: "Online · offline list 1,240 · 2 min ago" / "Offline · deciding on this phone · 3 to sync" / "Syncing…" / "Downloading list 4,000 of 12,500"; extra warning row when the clock is suspect or the offset is stale; "Refresh list" and "Sync now" actions (≥ 44 pt).
- **"2 need attention"** when duplicates, suspects, rejected, blocked or error items exist → read-only sheet: ticket type + number, both times, other scanner, the reason; note "The organiser sees these on the web." Nothing to undo.
- **Door counter** offline: computed from the local roster, with an offline tag.
- **Admitted (offline)** overlay: same as online Admitted plus the "Offline · will sync" tag.

## 8. Sign-out, wipe, expiry

- Sign-out **blocked** while any item is `pending` or `sending`: "3 admissions haven't synced — Sync now". Items in `blocked`/`error` can never sync; sign-out is then allowed after an explicit confirmation naming the count.
- After sign-out: close the DB, delete the DB file and its SecureStore key.
- A roster is dropped 48 h after its event ends, once that event's outbox has no `pending`/`sending` items.
- Confirmed lost assignment (Phase 1 flow): that event's roster is dropped immediately; its outbox stays until settled.

## 9. Verify before coding (expo-docs-researcher)

SQLCipher config plugin on SDK 57 and `PRAGMA key` usage; whether `@noble/curves` Ed25519 needs any RN shim; `expo-network` change events; any boot/elapsed-realtime clock exposed to JS; `expo-crypto` random bytes API. Read the web's `lib/ticket-tokens.js` (and its tests) for BH2 encoding and verify strictness.

## 10. Testing

- **TDD for domain:** `bh2` (test keypair, tamper cases on id/step/kid/sig, a vector generated by the web's signer, the ±1 step edges), `offlineDecide` (one test per table row), `clockGuard`, the batch reconciler (each response row), roster page merge and staging swap (in-memory fake).
- **Hooks/screens:** sync bar states, attention sheet, sign-out guard (RNTL v14 async).
- **Device (Moto G06):** 50k-row download time + resume, offline decision < 150 ms, scenarios 9–12, 14, 15, 15a–15c, 15e (inspect the local DB for no email/full phone), kill mid-sync.
- New native config (SQLCipher) → new dev and preview builds.
