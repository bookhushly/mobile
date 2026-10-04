---
description: Parallel specialist review of the current changes (code, security, performance, gate-logic as relevant)
---

Look at `git status` and `git diff`. Pick the relevant reviewers from `rn-code-reviewer`, `mobile-security-reviewer`, `perf-auditor`, `offline-scan-reviewer`, `ux-design-reviewer` (always `rn-code-reviewer`; add `ux-design-reviewer` whenever UI, theme or animation files changed) and launch them **in parallel in one message**, each told to review the current diff. $ARGUMENTS may name a focus area.

Merge their findings into one list ordered by severity, de-duplicated, each with file:line and a concrete failure scenario. Don't apply fixes unless asked; ask which to fix.
