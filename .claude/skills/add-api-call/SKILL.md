---
name: add-api-call
description: Use when adding or changing a client call to the Bookhushly web backend (any fetch to /api/*), including its zod schema, typed errors, TanStack Query hook and tests. Ensures contracts are verified and errors are mapped correctly.
---

# Add an API call

1. **Verify the contract.** Check `docs/BACKEND_STATUS.md`; if the endpoint isn't there or you're unsure, dispatch `backend-contract-checker`. If the route doesn't exist (server-action-only), stop: record it in BACKEND_STATUS §9 and tell the user — don't work around it.
2. **Schema.** In `src/features/<area>/schemas/` write zod schemas for the request and every response/error body; derive types with `z.infer`. Parse every response; unknown shapes become `ValidationError`, not crashes.
3. **Client function** in `src/features/<area>/api/` using the shared API client (never raw `fetch`). Map statuses to the typed taxonomy: 401 → refresh/re-auth, 403, 404, 409 (with the server `code`), **429/503/timeout/network → `Retryable`, never a business refusal**. Map to domain types before returning.
4. **Query hook** (if server state): query-key factory entry, sensible `staleTime`, mutation invalidates by key prefix; don't retry 4xx.
5. **Tests first** (domain-style, no real network; MSW at the boundary): happy path, each documented error `code`, 429/503, malformed body, auth refresh.
6. **Docs.** If you learned anything that differs from BACKEND_STATUS.md, update it (and say so).
7. Run `/verify`.
