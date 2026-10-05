---
paths:
  - "src/features/**/domain/**"
  - "src/shared/lib/**"
---
# Pure domain / lib code

- No imports from `react`, `react-native` or `expo-*` in `domain/` — it must run under plain Jest. Inject platform things (clock, storage, network, crypto) through small interfaces.
- Write the test first (TDD). Cover failure paths; expected failures are `Result` values, not thrown strings.
- Strict TS: no `any`, no `as` casts (use `unknown` + narrowing), exhaustive `switch` on discriminated unions, branded IDs (`TicketId`, `BookingId`) minted only in parse functions.
- Validate untrusted input (API payloads, storage reads, params, push payloads) with zod at the boundary; derive types with `z.infer`.
- Time: use an injected clock that applies the persisted server-clock offset; never call `Date.now()` directly in decision logic.
