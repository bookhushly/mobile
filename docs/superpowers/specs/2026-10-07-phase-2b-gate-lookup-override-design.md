# Phase 2b — Gate staff: lookup, override, activity and shift summary (design)

**Status:** approved in conversation 2026-10-07 · **Branch:** `feat/phase-2b-gate-lookup-override` · **Builds on:** Phase 2a (`2026-10-07-phase-2a-gate-offline-design.md`) · **Requirements:** FR-3.7, FR-3.8, FR-3.14, FR-3.15, FR-3.16; acceptance §11.2 scenarios 13, 15d · **Backend:** web `docs/superpowers/specs/2026-10-03-scan-override-pin-design.md`; batch contract in `docs/BACKEND_STATUS.md` §3.

## 1. Goal and success

Staff can let the right people in when a code won't do the job — a dead phone, a code that won't scan, a ticket bought after the last list sync — without opening a back door, and they can see and hand over everything the phone recorded.

Done when: a guest is found by name or phone digits and admitted from the list; an unlisted ticket is admitted with the supervisor PIN, a reason and an approver, and the exception reaches the server; wrong PINs lock the override; the activity screen shows every recorded admission and exports a CSV; the sign-out dialog shows the shift summary. Scenarios 13 and 15d pass on the Moto G06; the PIN check takes < 2 s there.

## 2. Decisions

1. **Lookup on a live-ticket event (`require_dynamic_ticket`) needs the supervisor PIN and an approver's name** (reason optional). Lookup skips the screenshot protection, so letting any staff member admit by name would undo it. On other events lookup is free; every lookup admission is flagged `manual_lookup`.
2. **Lookup and override admissions are local first**, online or offline: written to the outbox (write-ahead, as in 2a) before the overlay shows, then a sync is triggered at once. The live scan route cannot carry these modes. A duplicate the server catches appears afterwards under "needs attention"; the lookup list itself shows who is already in.
3. **The CSV export has no names or phone numbers:** ticket type and number, a short ticket reference (first 8 hex of the ticket id), scan time, mode, sync state, the server's note, reason and approver. The organiser has full details on the web; a CSV shared from a phone is where PII leaks.
4. **PIN check on the phone with `scryptAsync` from `@noble/hashes`** (made a direct dependency), constant-time compare, against the web's known-answer vector. Verifiers with parameters outside `N ≤ 2^15, r ≤ 16, p ≤ 4, dk_len = 32` are refused (treated as "no override"), so a tampered roster can't freeze the phone.
5. **Lockout:** 5 wrong PINs lock the override for 15 minutes; failures and lock-until live in SecureStore, keyed per account (survive restarts and sign-out, so signing out and in can't reset the count); the shift tally stays in the encrypted DB's `device` table and is wiped with sign-out. A correct PIN resets the count. The lock uses the server-corrected clock.
6. **Shift summary:** per-account counts of outcomes shown (Admitted, Already used, Refused, Couldn't check — online and offline alike) plus "still to sync"; shown in the sign-out dialog with a "Reset counts" action. Counts only, no PII.
7. **A removed PIN stops working at the next roster sync**: a first page with `override: null` clears the stored verifier (web decision 6).

## 3. Flows

**Find guest (FR-3.7, FR-3.8).** A new "Find guest" control on the scanner opens a sheet with a search box.
- Input normalisation: 2–4 digits → phone search; ≥ 2 letters → name search; otherwise no search. Masked phones show only the first 4 and last 3 digits (`0803••••210`): 2–3 digits match the visible tail, 4 digits match the visible head.
- Results (≤ 50, from the local roster): ticket type + number, holder name or masked phone, booking status, in / not in.
- Tapping a result opens the booking view: every ticket on that booking with in / not in (group context), and "Admit" on each confirmed ticket not yet in. Not-confirmed tickets show the status and no button.
- On a live-ticket event, "Admit" first opens the PIN sheet (PIN + approver; reason optional).
- Admit records `manual_lookup` with `code` = the ticket UUID and shows the normal Admitted overlay with the "Offline · will sync" tag replaced by "Lookup · will sync".
- No roster on the phone → the sheet says "No offline list on this phone yet".

**Supervisor override (FR-3.15).** The "Not in offline list" refusal overlay gains a "Supervisor override" action when the roster carries a verifier and the override is not locked (when locked: "Override locked — try again in N min", no action).
- The PIN sheet asks for the 6-digit PIN, a reason (3–200 characters) and the approver's name (1–80), shows "Checking…" while scrypt runs, and "Wrong PIN — N tries left" / the lock message on failure.
- Success records `offline_override` with `code` = the ticket UUID (never the scanned BH2 code, which the server would re-verify and refuse as expired after ~5 min; the server skips the liveness proof for override mode, and the phone checked the signature before "Not in offline list"), reason and approver (outbox only — the ticket is not in the roster), refused if this phone already has an outbox item for that ticket ("Already used — by you").
- The server still decides: `not_found`, `not_confirmed` etc. come back as rejected items under "needs attention".

**Activity (FR-3.14).** The attention sheet becomes an Activity screen (modal) with tabs **To sync**, **Needs attention**, **Synced**, newest first, paged; each row: ticket type + number, time, mode marker (lookup / override), state line (2a wording); "Sync now" and "Export CSV" (writes a temp file with `expo-file-system`, opens the share sheet with `expo-sharing`, deletes the file afterwards). The sync bar's "N need attention" opens it on the Needs attention tab.

**Shift summary (FR-3.16).** The sign-out dialog (all sign-out entry points) shows "This shift: N admitted · N already used · N refused · N to sync" when the account has a gate database; "Reset counts" clears the tally.

## 4. Architecture

| Unit | Where | Job |
|---|---|---|
| `overridePin.ts` | `features/gate/domain/` | `parseVerifier(json)` (bounds-checked) and `verifyPin(pin, verifier)` → boolean, async. |
| `overrideLock.ts` | `features/gate/domain/` | `lockState({failures, lockedUntil}, now)` → `{ kind: 'open', triesLeft } \| { kind: 'locked', minutesLeft }`; `afterFailure`, `afterSuccess`. |
| `lookupQuery.ts` | `features/gate/domain/` | `parseLookup(input)` → `{ kind: 'phoneTail' \| 'phoneHead' \| 'name', value } \| null`. |
| `csv.ts` | `shared/lib/` | `toCsv(rows)` with RFC 4180 quoting and formula-injection guard. |
| `activityCsv.ts` | `features/gate/domain/` | outbox items → CSV rows (decision 3 columns). |
| migration 2 | `features/gate/offline/schema.ts` | `roster_meta.override TEXT`, `outbox.reason TEXT`, `outbox.approved_by TEXT`; index `roster_ticket (event_id, booking_id)` already exists. |
| `rosterStore` | `offline/` | `search(eventId, q)`, `bookingTickets(eventId, bookingId)`, verifier stored by `beginSync` (first page). |
| `outboxStore` | `offline/` | `recordAdmission(… mode, reason, approvedBy)`; `recordOverride(input)`; `list(eventId, tab, beforeSeq, limit)`; `listAll(eventId)` for export. |
| `deviceStore` | `offline/` | lockout state over a per-account SecureStore key (survives sign-out); shift tally over the encrypted DB's `device` table (wiped at sign-out). |
| `batchSync` | `offline/` | items carry `mode`, `reason`, `approved_by`. |
| `offlineGate` / controller | `offline/` | `admitFromLookup(ticketId, approval?)`, `override(code, approval)`, `lockState()`, `tally(outcome)`, `summary()`. |
| roster schema | `schemas/roster.ts` | parse `override` (object or null). |
| UI | `features/gate/ui/` | `FindGuestSheet`, `BookingView`, `PinSheet`, `ActivityScreen`; overlay action; scanner control. |
| sign-out guard | `shared/lib/signOutGuard.ts` + gate guard | optional `summary(userId)` and `resetSummary(userId)`; auth's dialog shows it. |

All DB rules from 2a hold (serial queue; inside `tx` use only `t`; write-ahead before any success UI).

## 5. Error handling

- PIN check throws (bad verifier) → treated as "override unavailable", never as a wrong PIN, never as an admission.
- Lockout state unreadable → treat as locked for 15 minutes (fail closed) and report.
- Search error → "Couldn't search the list" in the sheet; the scanner is unaffected.
- Export failure (file write or share cancelled) → message in the Activity screen; the temp file is always deleted.
- An admission write that fails → "Couldn't check" overlay (nothing recorded), as in 2a.

## 6. Testing

- Domain TDD: PIN known-answer vector (`123456` / salt `ABEiM0RVZneImaq7zN3u_w` → hash `L8yIIos_9EAoJkqiN2s2Qv6pNMzKe65LM05K0fZtgeA`), wrong PIN, out-of-bounds verifier; lockout boundaries (4th/5th failure, expiry, reset); lookup normalisation; CSV quoting and injection guard; activity rows exclude names/phones.
- Stores on `node:sqlite`: migration 2 on a v1 database with data; search by name/head/tail with the 50-row cap; booking tickets; `recordOverride` duplicate guard; batch payload carries mode/reason/approved_by; tally and lockout persistence.
- RNTL: PinSheet (validation, checking state, wrong-PIN and locked messages), FindGuestSheet → booking view → admit, live-ticket event routes through the PIN, ActivityScreen tabs and export calls the share sheet, override action shown only with a verifier and no lock.
- Device (Moto G06): scrypt time < 2 s; search on a large roster < 300 ms; share sheet; scenarios 13 and 15d.
- New native dependency (`expo-sharing`) → new dev/preview build (the same one the 2a device run needs).
