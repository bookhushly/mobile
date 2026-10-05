---
description: Run the full pre-completion gate (typecheck, lint, tests, doctor) and report honestly
---

Run, in order, and report each result with real output (don't summarise failures away):
1. `npx tsc --noEmit`
2. `npx expo lint`
3. `npm test` (if a test script exists; otherwise say so)
4. `npx expo-doctor`

Then dispatch the `rn-code-reviewer` subagent on the current diff; add `mobile-security-reviewer` if auth/storage/crypto/payments/logging changed, `ux-design-reviewer` if any UI, theme or animation changed, `perf-auditor` if lists/scanner/animations/images changed, and `offline-scan-reviewer` if anything under `src/features/gate/` changed. Fix what's yours to fix, then re-run what failed. Finish with a plain status: what passed, what failed, what was skipped.
