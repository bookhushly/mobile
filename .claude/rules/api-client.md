---
paths:
  - "src/lib/api/**"
  - "src/features/**/api/**"
---
# API layer

- One client wrapper adds `Authorization: Bearer`, `X-App-Version`, `X-Platform`, timeouts, bounded retries with jitter (network/5xx only, never 4xx), and the `Date`-header clock offset.
- Map every failure to the typed taxonomy: 401 refresh/re-auth · 403 · 404 · 409 · **429 and 503/timeout/network = "try again", never a business refusal**.
- Contracts come from docs/BACKEND_STATUS.md; for anything not listed, read `../web` code first. Don't guess shapes. If you find a gap or mismatch, update BACKEND_STATUS.md.
- Parse every response with a zod schema; map DB/API shapes to domain types here — never leak raw rows to the UI.
- Never send client-computed prices as authoritative; send selections, server recomputes.
- Server state lives in TanStack Query (key factory per feature). Don't copy it into Zustand/useState.
