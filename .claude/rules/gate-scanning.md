---
paths:
  - "src/features/gate/**"
---
# Gate staff mode (scanning)

Spec: requirements §4, §8, FR-3.x; exact contracts: docs/BACKEND_STATUS.md §3.

- Outcomes are exactly: **Admitted / Already used (time + by whom) / Refused (specific reason) / Couldn't check — try again.** 429, 503, timeout, network errors are *never* "Do not admit".
- **No undo / un-admit** anywhere in gate mode.
- Port the scan-queue semantics (queue-don't-drop, de-dupe on code, concurrency 3, ≤2 retries with 400 ms × attempt backoff, replay of terminal results, hold times 1.6/3.2/3.2 s, refusals hold until dismissed). Camera keeps scanning while requests are in flight. Reference: `../web/lib/scan/queue.js`.
- `parseTicketCode`: `BH1.` and `BH2.` pass through untouched; otherwise extract the first UUID; anything else is rejected client-side.
- **Write-ahead:** persist the admission + outbox row to disk *before* showing success. Never lose an admission silently.
- Offline admit only when: roster hit, not already in, valid `BH2` signature, step within the window of the offset-corrected clock, event rules (`require_dynamic_ticket`) satisfied. `BH1` offline = "can't verify offline", never admit on ID alone. Unlisted ticket = override path only.
- Override PIN: scrypt verify locally; lock 15 min after 5 wrong attempts, counter persisted across restarts.
- Keep screen awake while scanning; haptic + audio per outcome with a mute toggle; sync state always visible.
- Roster is PII: encrypted store, name + masked phone only, wiped on logout only after the outbox is empty.
