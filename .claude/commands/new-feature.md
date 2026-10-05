---
description: Start a new feature properly — brainstorm, check requirements/backend, plan, scaffold (usage: /new-feature gate/event-list)
---

Feature: $ARGUMENTS

1. Read the matching requirements (FR ids in `docs/MOBILE_APP_REQUIREMENTS.md`), `docs/BACKEND_STATUS.md` (is the backend ready? if not, say so and stop to discuss), and the `.claude/rules/*.md` that will apply.
2. Invoke `superpowers:brainstorming`, then `superpowers:writing-plans`; the plan must name the files under `src/features/<area>/{screens,components,hooks,api,domain,schemas}`, the pure-logic units to TDD first, the test list including failure paths, and which reviewers will run.
3. For any Expo/library API involved, run `/expo-docs` first.
4. Wait for my approval of the plan before writing code. Then implement test-first for domain logic, run `/verify`, and `/review-changes`.
