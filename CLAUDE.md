@AGENTS.md

# Bookhushly mobile

Expo (SDK 57) / React Native app for iOS + Android: **customer**, **gate staff** (incl. offline), and **receptionist** modes, resolved at sign-in. The backend is the Next.js + Supabase repo at `../web` (read-only reference from here — don't edit it from this repo's sessions unless asked).

## Read first

- `docs/MOBILE_APP_REQUIREMENTS.md` — product requirements, FR/NFR IDs, phasing, decisions (§13).
- `docs/BACKEND_STATUS.md` — **verified backend state and exact API contracts; wins over the requirements doc where they differ.** Check the web code before trusting a contract for anything not listed there.
- `docs/ENGINEERING_STANDARDS.md` — researched performance, architecture, security, offline and release rules (with confidence markers and open items). Follow it; if a rule is marked [U] or listed under "verify before coding", verify before relying on it.
- `docs/DESIGN_SYSTEM.md` (tokens, 70/20/10, contrast, UX per mode, Mobbin references, decisions D1–D10, all answered) and `docs/MOTION.md` (Lottie/Reanimated rules, performance budget, motion tiers, animation inventory, decisions M1–M7, all decided). Build UI to these; keep values behind tokens.
- `../web/CLAUDE.md` and `../web/docs/superpowers/specs/` for backend behaviour.

## Rules specific to this project

- **Never put secrets in the app or repo**: no service-role key, `TICKET_TOKEN_SECRET`, Paystack/NOWPayments secrets. Only the public Supabase URL + anon key (via `EXPO_PUBLIC_*` env). Don't read `../web/.env.local` — the one owner-approved exception is `.claude/hooks/copy-public-env.sh`, which copies only the two public Supabase values into this repo's gitignored `.env.local` (already run on 2026-10-04).
- **API base URL is the apex `https://bookhushly.com`** — `www` 308-redirects and the redirect drops the Bearer header.
- **Production Supabase is live.** No destructive calls, no test data left behind. Provision test accounts through real flows. Point dev builds at staging only once Bearer works there (see BACKEND_STATUS §8).
- **Server-side authorisation is the truth**; hide UI the user can't use, but never rely on it.
- **Never trust client prices**; send selections, the server recomputes.
- **Never render a transient failure (429/503/timeout/network) as a business refusal.** Gate scanning outcomes are: Admitted / Already used / Refused (specific reason) / Couldn't check — try again. No undo for gate staff.
- **No lost admissions**: write the outbox to disk *before* showing success.
- Tokens only in `expo-secure-store`; the offline roster (PII) in an encrypted store, wiped on logout once the outbox is empty.
- Crypto verification uses a vetted library (e.g. `@noble/ed25519`); never hand-roll.
- Never assume payment success from a redirect; confirm via the status/verify endpoints.

## Design

Light UI only. Violet `#7C3AED`, ink `#1A0D4D`, tints `#FFFFFF` / `#F8F7FB`. Fonts: Radio-Canada (UI) + Source Serif 4 (display). Min text 12 px, sentence-case labels, semibold headings, touch targets ≥ 44 pt. Outcomes use colour + icon + text + haptic. Avoid centered-everything heroes, gradients/glows, fake stats, and the banned fonts listed in requirements §1.3. The template's dark-mode/theme scaffolding (`useColorScheme`, themed components) should be replaced, not extended.

## Code conventions

- TypeScript strict; path alias `@/*` → `src/*`. Routes only in `src/app/`; everything else (components, hooks, `lib/`, features) outside it.
- Organise by feature (`src/features/{auth,gate,receptionist,customer}`) with shared code in `src/shared/{api,config,lib,platform,supabase,theme,ui,providers}`. Keep pure logic (scan queue, BH2 verification, decisioning, outbox) free of React so it's unit-testable.
- One API client wrapper: adds `Authorization`, `X-App-Version`, `X-Platform`, timeouts, bounded retries with jitter, and maps statuses to a typed error taxonomy (401/403/404/409/429/503).
- Match the surrounding code's style; no speculative abstractions.
- Install packages with `npx expo install <pkg>`. Native modules need a dev build, not Expo Go.

## Project tooling (`.claude/`)

- **Rules** (`rules/*.md`, path-scoped, load automatically when you touch matching files): routing, domain-logic, components-ui, design-system, motion, api-client, gate-scanning, offline-storage, payments-customer, testing.
- **Hooks** (enforced, not advisory): block edits to `.env*`/`ios/`/`android/`/`../web`/`package-lock.json`; block `npm|yarn|pnpm|bun add`, plain force-push (only `--force-with-lease`, never on main), Claude co-author trailers on commit/push, `git add -A`, and commit/push on `main`/`master`; reject `any`, `@ts-ignore`, `console.log`, raw hex, `fontWeight`, animated layout props, secrets, domain→React imports and cross-feature imports after each source edit; require a clean `tsc` before a turn can finish when `src/` changed. A hook hit is a real rule — fix the code; if it is a false positive, say so.
- **Subagents:** `expo-docs-researcher` (verify SDK 57 APIs before coding), `backend-contract-checker`, `rn-code-reviewer`, `mobile-security-reviewer`, `perf-auditor`, `offline-scan-reviewer`, `ux-design-reviewer`.
- **Commands:** `/new-feature`, `/expo-docs`, `/backend-check`, `/verify`, `/review-changes`, `/phase-status`. **Skill:** `add-api-call`.

## Workflow

1. Before any Expo/RN API use, check the SDK 57 docs (`https://docs.expo.dev/versions/v57.0.0/`) — don't rely on memory.
2. Tests: `@testing-library/react-native` v14 is async (`await render`, `await fireEvent…`); Jest can't do dynamic `import()`; zod is v4 (`z.url()`, `z.email()`).
3. Non-trivial features: brainstorm → short plan → implement (superpowers skills). Pure logic gets tests first (TDD).
4. Before declaring done: `npx tsc --noEmit` and `npx expo lint` must pass, plus tests for what you touched. Report failures honestly.
5. **Never add a Claude/Anthropic co-author trailer to commits** — owner rule, enforced by native git hooks in `.githooks/` (`commit-msg`, `pre-push`; wired via `core.hooksPath` by `npm install`'s `prepare` script) and, best-effort, by `guard-bash.sh`. Commits only when asked; branch off `main` (never commit straight to `main`); stage specific paths.
6. Backend gaps found while working go into `docs/BACKEND_STATUS.md` §9 rather than being worked around silently.
7. Phase order: 0 foundations → 1 gate online → 2 gate offline → 3 receptionist → 4 customer (blocked on web work, see BACKEND_STATUS §9).
