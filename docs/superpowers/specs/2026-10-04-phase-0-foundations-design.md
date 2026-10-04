# Phase 0 — Foundations (design spec)

Status: **draft for owner review** · 2026-10-04 · Path: architectural (brainstorming → spec → plan).
Inputs: `docs/MOBILE_APP_REQUIREMENTS.md`, `docs/BACKEND_STATUS.md`, `docs/ENGINEERING_STANDARDS.md`, `docs/DESIGN_SYSTEM.md`, `docs/MOTION.md`, `CLAUDE.md` + `.claude/` rules.

## 1. Intent

**Goal.** A runnable, enforced foundation so Phase 1 (online gate scanning) can start immediately. No product features.

**Success criteria** (all must hold):
1. On the Moto G06 (Android 15, 4 GB) a **release build** launches, loads fonts with no fallback flash, signs in with a real account against production Supabase, restores the session after a kill/relaunch, and lands in the correct mode shell (customer / gate / receptionist) or the "use the web dashboard" screen for vendor/admin/support.
2. One real authenticated call through the API client succeeds with Bearer + `X-App-Version`, and 401/403/404/409/429/503/timeout/network failures map to the typed error taxonomy (unit-tested).
3. `npx tsc --noEmit`, `npx expo lint`, `npm test` and `npx expo-doctor` pass locally and in CI; the existing `.claude` hooks run against real tooling.
4. Light-only design tokens + primitives in place; the template's dark-mode scaffolding and demo screens are gone.

**In scope:** tooling/CI/EAS profiles; theme, fonts, `src/ui` primitives; env parsing; Supabase client + encrypted session store; API client; TanStack Query wiring; auth shell (sign-in, sign-out, session restore); mode resolution; navigation shells (placeholder screens); error boundaries; logger; Sentry; min-version gate screen; vendor "use the web" screen.

**Out of scope (deferred, with reason):** sign-up (server action only → web work), forgot/reset password (needs universal links → web work), onboarding (Phase 4, customer), any gate/receptionist/customer feature, Lottie (not installed in v1), push, SQLite/offline storage (Phase 2), biometric app lock (FR-1.7, later).

**Backend target:** production Supabase (`https://wdhhbgxdpjjuqjideqws.supabase.co`) and `https://www.bookhushly.com` — carefully: no destructive calls, test accounts via real flows. Switch to staging once the web team exempts Bearer from the Basic-auth wall (BACKEND_STATUS §8).

## 2. Architecture

### 2.1 Layout

```
src/
  app/                      # thin routes only (Expo Router)
    _layout.tsx             # providers, splash hold, Stack.Protected layers
    (auth)/sign-in.tsx
    (gate)/ …  (receptionist)/ …  (customer)/ …   # placeholder tab/stack shells
    web-only.tsx            # vendor/admin/support
    update-required.tsx
  features/
    auth/      {screens,hooks,api,domain,schemas}
    mode/      {domain (resolveMode), hooks, api}
    gate/ receptionist/ customer/     # empty shells with a placeholder screen each
  shared/
    config/env.ts           # zod-parsed env, fails fast
    api/                    # client, errors, query client, clock offset
    supabase/               # client + large-secure-store
    ui/                     # Text Box Stack Inline Button Input Card Icon Money Screen
    theme/                  # tokens, theme, density, fonts
    lib/                    # logger, result, ids, device
```

Rules (already enforced by `.claude/rules` + hooks): routes thin; features → shared only; domain code free of React/Expo; semantic theme roles only in screens.

Note: `docs/DESIGN_SYSTEM.md` sketches `src/theme` + `src/ui`; this spec places them under `src/shared/` to match the hooks' feature-boundary rule. `.claude/hooks` already allow both paths.

### 2.2 Config and environment

- `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` (the web project names it `…ANON_KEY`; confirm the key type it actually issues before wiring), `EXPO_PUBLIC_API_BASE_URL` (`https://www.bookhushly.com`), `EXPO_PUBLIC_SENTRY_DSN`. Static `process.env.EXPO_PUBLIC_X` access only.
- `src/shared/config/env.ts` parses once with zod and throws a readable error at startup. `.env.local` gitignored, `.env.example` committed (no values for secrets; there are none client-side). **Never read `../web/.env*`:** the owner supplies the two public values (or I copy them with explicit permission).
- Build-time values via `eas.json` profile `env`; secrets (`SENTRY_AUTH_TOKEN`) only as EAS secret variables.

### 2.3 Auth and session

- `@supabase/supabase-js` with `signInWithPassword`. Client options: `autoRefreshToken: true`, `persistSession: true`, `detectSessionInUrl: false`, `storage: LargeSecureStore` (below).
- **LargeSecureStore** (Supabase's documented pattern): a 32-byte AES key in `expo-secure-store` (`WHEN_UNLOCKED_THIS_DEVICE_ONLY`), the AES-CTR ciphertext in AsyncStorage. Needs `aes-js` + `react-native-get-random-values`. **First-launch marker:** a flag in AsyncStorage; if the flag is absent but a Keychain key exists (iOS survives uninstall), delete the key and any session before use. Unit-test the encrypt/decrypt round trip and the marker logic behind a storage interface (domain code, no Expo imports).
- `AppState`: `startAutoRefresh()` on active, `stopAutoRefresh()` on background.
- Session lifecycle: `onAuthStateChange` drives a small auth store (Zustand: `status: 'loading' | 'signedOut' | 'signedIn'`, `user`). Splash stays up until `status !== 'loading'` **and** (if signed in) mode resolution has settled or failed to a retry state.
- Refresh failure → sign out and return to sign-in; **must not touch unsynced gate data** (nothing exists yet; the store boundary is designed so Phase 2's outbox is untouched).
- Sign-in errors: map Supabase auth errors (invalid credentials, email not confirmed, rate-limited, network) to user copy; respect the `auth` limit (5/min/IP) with "try again in a minute".
- Account identity is always visible on shared devices (name/email in an account sheet — FR-1.9; the sheet itself is a Phase 1 screen, the data is exposed by the store).
- Verification: `supabase.auth.getClaims()` is local; server routes authorise regardless.

### 2.4 Mode resolution (FR-1.4)

Data via direct Supabase reads under RLS (verified in the web baseline migration): `users` (select own), `hotel_staff` (`hotel_staff_read_own`), `event_scanners` (`event_scanners_self_select`).

```
resolveMode(profile, hotelStaffRow, activeScannerRows) → { modes: Mode[], defaultMode, reason }
  vendor|admin|support          → 'web-only'       (FR-1.6; vendor who owns events may get gate later)
  role=receptionist && hotelRow → 'receptionist'
  active event_scanners ≥1      → 'gate'
  else                          → 'customer'
```

- Pure function in `features/mode/domain`, exhaustively tested (incl. multiple qualifying modes → modes list + remembered last mode; **last mode remembered per device** in AsyncStorage).
- Known limitation: scan/roster require the scanner to be active in **both** `event_scanners` and `vendor_scanners`; mode resolution only sees `event_scanners.is_active`. A mismatch surfaces later as `forbidden` (handled as an assignment problem, not a crash). Revisit with the web team if it matters.
- Vendor-owner-as-scanner (FR-1.6 caveat) is **not** handled in Phase 0 (needs the listings-owner read; Phase 1 decision).
- Fetch failure ≠ customer: a failed resolution shows a retry screen; never silently fall back to customer for a staff account.

### 2.5 API client (NFR-2.4, NFR-5.6)

- `shared/api/client.ts`: `request<T>(path, {method, body, schema, signal})` → `Promise<Result<T, ApiError>>`. Adds `Authorization: Bearer <access_token>` (fresh from the session), `X-App-Version` (`expo-application` version+build), `X-Platform`, `Accept`, JSON; per-request timeout (default 15 s, AbortController); bounded retries with jitter **only** for network/timeout/5xx and idempotent methods (GET, or a request marked `idempotent: true`); never retries 4xx or 429 automatically (429 → `RateLimited` with `Retry-After` seconds when present).
- Parses every response body with the supplied zod schema; mismatch → `ValidationError` (logged without payload).
- **Clock offset:** every successful response's `Date` header updates a persisted `serverOffsetMs` (`shared/api/clock.ts`, injected into domain code; Phase 2 consumes it).
- 401 → one silent session refresh + one retry; second 401 → `AuthError` → sign-out flow.
- Error taxonomy (`shared/lib/errors.ts`): `Network | Timeout | Auth | Forbidden | NotFound | Conflict(code) | RateLimited(retryAfter) | Unavailable | Validation | Unknown`, each with `isRetryable` and a user-copy key. 429/503/timeout/network are `retryable` and **never** a business refusal.
- One real call in 0.3: `GET /api/health`-style or an authenticated read (decided in the plan: prefer a read that exercises Bearer — e.g. the user's own profile via Supabase for the data path and an API route such as `GET /api/customer/kyc` for the Bearer path).
- TanStack Query: single `QueryClient` (`retry` delegates to `isRetryable`, `staleTime` sane defaults), `focusManager` ↔ `AppState`, `onlineManager` ↔ `expo-network` (default; NetInfo not used). Persistence of the query cache is **not** added in Phase 0 (no PII-safe cache policy yet).

### 2.6 Navigation

- Root `_layout`: providers (QueryClient, auth, theme), `SplashScreen` hold, Sentry wrap. `Stack.Protected` layers: signed-out → `(auth)`; signed-in + mode `web-only` → `web-only`; `gate` → `(gate)`; `receptionist` → `(receptionist)`; `customer` → `(customer)`. `update-required` takes precedence over everything when the version gate trips. Guards are UX only.
- Mode switcher stub: if `modes.length > 1`, an account sheet entry (placeholder in Phase 0, functional list).
- Each mode shell renders a minimal placeholder (name, signed-in identity, sign-out, mode label) built with the real primitives — it doubles as the on-device design-system check.
- Error boundaries: root + per-route `ErrorBoundary` exports with retry; no raw errors shown.
- `typedRoutes` stays on. `userInterfaceStyle: "light"`; the status bar uses dark content.

### 2.7 Theme, fonts, primitives (docs/DESIGN_SYSTEM.md)

- Two-layer tokens: private palette primitives; public semantic roles (`color.action`, `color.text`, `color.surface`, `color.outcome.*`, …). Spacing `s1…s11`, radius `r1…r4`, type variants as specified, density sets (`customer | work | gate`), light-only constant `ThemeProvider` (no `useColorScheme`).
- Fonts via the **`expo-font` config plugin** (no `useFonts`, no fallback flash): Radio-Canada 400/500/600 (+700 numerals) and Source Serif 4 500 (+italic) from `@expo-google-fonts/*`. Android uses `android.fonts` family definitions; iOS uses PostScript names; a `fonts.ts` map hides the platform difference. **File names and iOS PostScript names are verified against the installed package files at install time, not assumed.** Never use `fontWeight`.
- Primitives: `Text` (variants, numeric/tabular, `maxFontSizeMultiplier`), `Box`/`Stack`/`Inline` (token-key props), `Button`, `Input`, `Card`, `Icon` (lucide via `react-native-svg`), `Money`, `Screen` (safe area + gutter), plus a throwaway `__preview` route (dev only, removed or gated) that renders every token/variant for the on-device check.
- Contrast test: a unit test asserts every semantic text/background pair meets its documented ratio (WCAG formula, values from DESIGN_SYSTEM §4.2).
- Delete: `src/components/*` template files, `constants/theme.ts`, `hooks/use-color-scheme*`, `global.css` (unless a build needs it), template tabs and `explore.tsx`, and unused template assets.

### 2.8 Observability and gates

- **Logger** (`shared/lib/logger.ts`): levels, no-ops debug in production, scrubs known-sensitive keys (tokens, `ticket_id`, emails, phones), is the only `console` user. Sentry breadcrumbs from it.
- **Sentry** (`@sentry/react-native`, config plugin, `getSentryExpoConfig`, `Sentry.wrap`); `beforeSend` strips PII; release/build tagging; DSN from env; sample rates conservative. If no DSN is supplied yet, init is a no-op and a TODO is tracked (owner must create the Sentry project).
- **Version gate:** `GET` a min-supported-version endpoint **does not exist** on the backend (BACKEND_STATUS §8). Phase 0 builds the **screen + client-side comparison + a pluggable source**; the source is a local constant (`MIN_SUPPORTED_VERSION`) until web ships an endpoint (tracked in BACKEND_STATUS §9). Never block on a failed fetch.
- **Vendor/admin/support** → `web-only` screen with a link to the web dashboard.

### 2.9 Tooling, CI, builds

- **Dependencies (all via `npx expo install`; versions confirmed at install):** `@supabase/supabase-js`, `@react-native-async-storage/async-storage`, `expo-secure-store`, `expo-crypto` (only if the LargeSecureStore spike needs it), `aes-js` (+ `@types/aes-js`), `react-native-get-random-values`, `react-native-url-polyfill`, `@tanstack/react-query`, `zod`, `zustand`, `expo-network`, `expo-application`, `expo-localization` (later if i18n lands), `react-native-svg`, `lucide-react-native`, `@expo-google-fonts/radio-canada`, `@expo-google-fonts/source-serif-4`, `@sentry/react-native`, `expo-dev-client`; dev: `jest-expo`, `jest`, `@types/jest`, `@testing-library/react-native` (+ `test-renderer` if its peers need it), `prettier`, `eslint-config-prettier`, `typescript-eslint`. Anything unverified (RN 0.86 compatibility of `aes-js`/polyfills, `lucide-react-native` New Architecture status, whether the compiler ESLint rules are in `eslint-plugin-react-hooks`) is checked at the moment of install, and a failure is a plan-level decision, not improvised.
- **ESLint** (`eslint.config.js`, flat): `eslint-config-expo` + `typescript-eslint` (strict-type-checked, `projectService`) + `no-restricted-imports` encoding the feature-boundary and "no direct `react-native` `Text`/palette/hex" rules + import ordering; Prettier for formatting. `tsconfig`: `strict` plus `noUncheckedIndexedAccess` (verify TS 6 flags before adding `exactOptionalPropertyTypes`).
- **Tests:** `jest-expo` preset; `npm test` = `jest`; pure-logic tests first (errors, `resolveMode`, clock offset, LargeSecureStore, token contrast, env parsing, API client with a fake `fetch`); RNTL for sign-in screen and the mode shells (role/label queries). No snapshot tests. Maestro deferred to Phase 1.
- **CI** (GitHub Actions, if the repo is on GitHub — confirm remote): typecheck, lint, tests, `expo-doctor` on every PR.
- **EAS** (`eas.json`): `development` (`developmentClient`, internal, APK), `preview` (internal APK, release JS), `production`. Each bound to an env. Local dev build via `npx expo run:android` (Android SDK + adb + JDK are already installed) for the fastest loop; EAS cloud as the reproducible path. **Smoothness check on the Moto G06 uses a release variant** (`--variant release` or a preview APK), never dev mode.
- Git: work on a feature branch (the repo is on `master`; hooks block commits there), Conventional Commits, small PRs.

## 3. Milestones and acceptance

| # | Deliver | Acceptance (verified, not claimed) |
|---|---|---|
| **0.1** Tooling | deps for tooling, ESLint/Prettier/tsconfig, Jest, CI workflow, EAS profiles, `.env.example`, branch | `tsc`, `lint`, `test`, `expo-doctor` green locally; sample test runs; hooks fire on a deliberate violation; CI green on a PR (if remote exists) |
| **0.2** Theme + UI | tokens, fonts plugin, primitives, template deletion, `__preview` route | contrast test passes; dev build on the Moto G06 shows correct fonts (₦ ẹ ọ ṣ ị ụ, tabular figures) with no flash; no dark-mode code remains |
| **0.3** The slice | env, Supabase client + LargeSecureStore, API client + errors + clock, query client, auth store, sign-in, mode resolution, three shells, web-only screen, one real call | unit tests for errors/clock/store/resolveMode/client; **release build on the Moto G06**: sign in with a real account → correct shell; kill + relaunch restores the session; airplane mode/429/503 simulated → "try again", never a refusal |
| **0.4** Hardening | error boundaries, logger, Sentry, version-gate screen, remaining tests, docs updates | a thrown render error shows the boundary with retry; Sentry receives a test event (if DSN supplied); `docs/BACKEND_STATUS.md` §9 and `CLAUDE.md` updated with anything learned |

Each milestone ends with `/verify` + `/review-changes` and a short status; hardening items that surface (e.g. scrypt/Ed25519 benchmarks) are **not** Phase 0.

## 4. Risks and verification tasks

| Risk / unknown | Handling |
|---|---|
| LargeSecureStore deps (`aes-js`, polyfills) on RN 0.86 / Hermes | Spike in 0.3 before building on it; fallback: SecureStore-held encryption key via `expo-crypto` AES-GCM (verify availability) |
| Supabase issues a legacy anon key vs publishable key | Owner supplies the value; client works with either; confirm name |
| Font file names / iOS PostScript names | Read them from the installed packages in 0.2; do not hard-code from memory |
| `eslint-plugin-react-compiler` status vs hooks plugin | Check at 0.1; rely on `expo lint`'s compiler rules (SDK 55+) |
| `@testing-library/react-native` peer (`test-renderer`) | Resolve at 0.1 |
| Production Supabase has ~no users | Owner creates a customer test account via the web flow; gate/receptionist accounts via vendor/admin flows (BACKEND_STATUS §8); until then shells are verified with the customer account plus unit tests for the other modes |
| No CI remote | Confirm the git remote; otherwise CI is written but unexercised |
| Sentry project/DSN not created | Init is a no-op without a DSN; owner action tracked |
| Backend gaps affecting later phases | Recorded in BACKEND_STATUS §9; not worked around |

## 5. Needs from the owner (not blockers for 0.1)

1. Public Supabase URL confirmation + anon/publishable key value (or permission to copy it from `../web/.env.local`).
2. A **customer test account** on production (created via the real sign-up flow on the web), and later a gate-staff and a receptionist account.
3. A Sentry project/DSN (can be deferred to 0.4).
4. The GitHub remote for this repo (for CI), if one exists.
