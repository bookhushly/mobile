---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "**/__tests__/**"
---
# Tests

- Pyramid: many pure-logic Jest tests → some RNTL component/hook tests (`jest-expo`, query by role/label, MSW at the network boundary) → few Maestro flows. No snapshot tests for UI.
- Test behaviour and failure paths (429/503 ≠ refusal, duplicate scan, expired code, tampered BH2, clock skew, outbox crash recovery, double-submit payment). Use the known-answer vectors from the specs for BH2/scrypt.
- Deterministic: inject the clock and randomness; no real network, no real storage in unit tests.
- `console.log` is allowed here; `any` is not.
