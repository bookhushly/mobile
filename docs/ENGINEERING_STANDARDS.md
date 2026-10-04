# Engineering standards

Researched 2026-10-04 for **Expo SDK 57 / React Native 0.86 / React 19.2 / TypeScript 6**, New Architecture + Hermes + React Compiler. These are the rules we build to; `CLAUDE.md` links here.

**Confidence markers:** **[V]** = checked against a fetched doc page. **[U]** = from general knowledge / engineering practice, not verified for these versions — treat as a default to confirm, not a fact. Items listed in §9 must be resolved before relying on them. Expo APIs change every SDK: check `https://docs.expo.dev/versions/v57.0.0/` before using any Expo API (some "latest" pages already describe SDK 58).

---

## 1. Structure and routing

1. Route files in `src/app/**` are thin: read params, render a screen imported from `src/features/<name>/`, export an `ErrorBoundary` where useful. No fetching, formatting or business logic. [V AGENTS.md]
2. Feature folders: `src/features/<name>/{screens,components,hooks,api,domain,schemas}`, shared code in `src/shared/{ui,lib,theme,config}`. One-way imports: features → shared, never shared → features, never feature → feature. Enforce with `no-restricted-imports` / eslint-plugin-boundaries from day one. [U]
3. `experiments.typedRoutes` stays on; use absolute `href`s. [V]
4. Route params are always strings and untrusted: `useLocalSearchParams<{id: string}>()` then parse with a schema. Prefer `useLocalSearchParams` over `useGlobalSearchParams` (the latter re-renders background screens). Avoid reserved param names `screen`, `params`, `initial`, `state`. [V]
5. Auth gating: `<Stack.Protected guard={…}>` in the root layout, layered (signed-out → signed-in → onboarded). It is UX only — **RLS/server is the security**. `redirectTo` on Protected is **not** available in SDK 57. Keep the splash screen up until the session is restored to avoid guard flashes. [V / U]
6. `ErrorBoundary` exported from routes (gets `error`, `retry`); `unstable_settings.screenErrorBoundary` keeps headers/tabs mounted (note the `unstable_` prefix on upgrades). [V]
7. Treat every inbound deep link / push payload as untrusted: validate with a schema and allow-list routes. [U]

## 2. TypeScript and domain code

1. Pure domain logic (scan queue, BH2 verification, offline decisioning, outbox, pricing, date maths) lives in `features/*/domain/` with **no React/Expo imports** so it runs under plain Jest. [U]
2. `strict: true` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` (verify TS 6 defaults/flags). typescript-eslint `strict-type-checked` + `stylistic-type-checked` (not semver-stable → pin the version). [V configs / U flags]
3. No `any`, `@ts-ignore`, or `as` casts. Use `unknown` + narrowing; `@ts-expect-error` with a reason if unavoidable. Enable `no-floating-promises`, `no-misused-promises`, `switch-exhaustiveness-check`. [U]
4. Expected failures are values: `Result<T,E>` discriminated unions, exhaustively narrowed with `never`. Typed error taxonomy: `Network | Auth | Validation | NotFound | Conflict | RateLimited | Unavailable | Unknown`, normalised in the `api/` layer and mapped to user copy + action. Never throw strings. [U]
5. Branded IDs (`TicketId`, `BookingId`) minted only in parse functions. [U]
6. Validate every untrusted boundary (API responses, params, storage reads, push payloads, env) with zod (valibot if bundle size matters); derive types with `z.infer`. [U]
7. Generate Supabase types (`supabase gen types typescript`), use `createClient<Database>()`; regenerate in CI and fail on drift. Map DB rows to domain types in `api/` — don't leak rows to the UI. [V gen types / U]

## 3. State

1. **TanStack Query for all server state**; never copy query data into Zustand/`useState`. Wire RN managers: `focusManager` ↔ `AppState`, `onlineManager` ↔ network state. Refetch on focus with `useFocusEffect` (skip first mount). [V]
2. Offline read cache: `PersistQueryClientProvider`; `gcTime >= maxAge`; set a `buster` (app/schema version); gate on `useIsRestoring`. **Never persist sensitive data in AsyncStorage.** [V]
3. Query-key factory per feature; invalidate by prefix; optimistic updates only with rollback. Don't retry 4xx; retry network/5xx with backoff (confirm `networkMode` behaviour). [U]
4. Zustand for small client-only state (UI flags, drafts) with **selectors** (`useStore(s => s.x)`); Context only for stable values (theme, session shell, i18n). [U]
5. Forms: react-hook-form + `zodResolver`, schema shared with the API boundary. [U]

## 4. Components, styling, design system

1. React Compiler stays **on** (`experiments.reactCompiler`). Write plain idiomatic React; **no `useMemo`/`useCallback`/`memo` by default**. Keep manual memo only where a value is an effect dependency or a profiler shows the compiler skipped it; don't strip existing memoization. Don't mutate props/state/refs in render. Compiler lint rules ship in `npx expo lint` since SDK 55 — treat them as errors. `"use no memo"` only per component, with a comment. [V]
2. Keep `react-hooks/exhaustive-deps` as an error. No `useEffect` for derived state or data fetching. [U]
3. Design tokens (colour roles, spacing, radii, type scale) consumed only through shared primitives (`Text`, `Button`, `Screen`, …). No raw hex or magic numbers in screens. **Light-only** per product decision: set `userInterfaceStyle: "light"` and remove the template's dark-mode scaffolding. [V tokens concept]
4. One styling system: plain `StyleSheet` + tokens (Expo recommends no library). Unistyles v3 only if theming becomes painful (needs a dev build; check it). Never mix NativeWind/Tamagui/StyleSheet. [V / U]
5. Composition over boolean-prop explosion; props typed, callbacks `onX`, accept `style` + `testID`. One component per file, named exports (default only where Router requires it). Soft limits ≈200 lines/component, ≈100 lines/hook (team convention). Container hook (`useXScreen`) + presentational view. [U]
6. Accessibility: every pressable has `accessibilityRole`, label, and state; touch targets ≥44pt/48dp; respect Dynamic Type (don't blindly disable font scaling), WCAG AA contrast, reduced motion; test with VoiceOver and TalkBack. Outcomes use colour + icon + text + haptic. [V RN a11y / U]
7. i18n from day one: externalise all strings (i18next + `expo-localization`, or Lingui); NGN/dates via `Intl`, centralised; `Africa/Lagos` handling. [U]

## 5. Performance (ordered by impact)

1. **Measure only in release builds on a real low-end Android phone.** Dev mode is misleadingly slow. [V]
2. **Virtualise every long list**; never `ScrollView` + `.map()`. FlatList: set `keyExtractor`, `getItemLayout` for fixed rows, `initialNumToRender` ≈ one screen, tune `windowSize`/`maxToRenderPerBatch`. FlashList v2 (recycling) is the pick for big/heterogeneous lists: no `key` on item roots, `getItemType` for mixed rows, memoise props passed to the list, `recyclingKey` on images. LegendList is an alternative — benchmark on our data. For the 50k-row roster, page from SQLite; never hold all rows in React state. [V / U]
3. **Animate on the UI thread** (Reanimated worklets + gesture-handler). Animate `transform`/`opacity` only — never width/height/top/left/margin/padding. Don't read `.value` on the JS thread in hot paths. ≲100 concurrent animated components on low-end Android. Memoise gesture objects. [V]
4. Consider Reanimated feature flags for specific symptoms (scroll FPS, many animations) — check they exist for Reanimated 4.5 / RN 0.86 first. 120 fps iOS: `CADisableMinimumFrameDurationOnPhone`. [V]
5. **Keep the JS thread free:** no `console.log` in production; defer non-urgent work (`InteractionManager`, `requestIdleCallback`); no big loops/JSON/sorts on tap or render paths. [V]
6. **Images:** `expo-image` (not `Image`): `cachePolicy`, blurhash `placeholder`, explicit width/height + `contentFit`, `Image.prefetch()`, `priority` on hero images. Serve resized variants (Cloudinary transforms) — never full-res thumbnails. [V]
7. **Startup:** Hermes (default); defer analytics/SDK init until after first render; embed fonts via the `expo-font` config plugin; hold the splash only until first-screen data + fonts are ready. Expo Router async routes are **not** production-ready on native — don't count on them; lazily `import()` heavy modules instead. [V / U]
8. **Bundle size:** analyse with `EXPO_ATLAS=true npx expo export` + `npx expo-atlas`. Tree shaking is on by default (SDK 54+) but needs ESM — no CJS barrel imports (import specific paths), no Babel plugins that convert ESM→CJS. Don't ship Intl polyfills (Hermes has Intl) — verify. [V / U]
9. Clean up everything that outlives render (listeners, AppState/Keyboard subscriptions, timers, `cancelAnimation`). Dedupe/cache network via TanStack Query; fire independent requests in parallel; paginate. [U]
10. Profile with: React DevTools Profiler (re-renders), Perf Monitor (JS vs UI FPS), Flashlight (Android release scoring), EAS Observe (real-user metrics; SDK 57 build). Budget: cold start ≤2.5 s mid-range Android; scan decision ≤150 ms offline (NFR-1.x). [V Observe]
11. Low-end Android checklist: smaller `windowSize`, downscaled images, capped animations, R8 shrinking via `expo-build-properties` (verify), baseline traces on a real mid-range device. [U]

**Outdated myths:** "the bridge is the bottleneck" (New Architecture/JSI); "memoise everything" (compiler); `react-native-fast-image` (use `expo-image`); `source-map-explorer` (use Atlas); installing the compiler runtime/ESLint plugin by hand (not needed on SDK 57).

## 6. Security and storage

1. Tokens/keys only in `expo-secure-store`, and only **small** values (large values can be rejected; some iOS versions refused >~2 KB). [V]
2. **iOS Keychain items survive uninstall; Android's don't.** Keep a first-launch marker in non-secure storage; if the marker is absent but Keychain items exist, wipe them before use. [V]
3. Choose `keychainAccessible` deliberately (e.g. `WHEN_UNLOCKED_THIS_DEVICE_ONLY` for key material); use `requireAuthentication` only for high-value keys (needs a dev build + Face ID string; test biometric-enrolment changes). [U — confirm option names]
4. **Offline roster (PII) = SQLCipher-encrypted `expo-sqlite`** (config plugin `useSQLCipher: true`, `PRAGMA key` right after open; dev build/prebuild only). Random 32-byte key from `expo-crypto`, stored in SecureStore; never hard-coded or derived from a constant. Scope to assigned events, expire after event + grace, wipe on logout once the outbox is empty. [V]
5. **Supabase session:** the JSON often exceeds SecureStore limits → AES key in SecureStore + encrypted session in AsyncStorage/DB. `AppState` listener: `startAutoRefresh()` on active, `stopAutoRefresh()` on background; `detectSessionInUrl: false`. Use `getClaims` for local validation; client checks are never authorisation. [V pattern / U code]
6. No secrets in `EXPO_PUBLIC_*` (inlined in the bundle). Reference as static `process.env.EXPO_PUBLIC_X` (bracket access isn't inlined). Parse env once in `src/shared/config/env.ts` with a schema that fails fast. [V]
7. Sensitive screens (rotating tickets, hotel code QR): `usePreventScreenCapture()` and `enableAppSwitcherProtectionAsync()` per ticket type (conflicts with letting guests save static tickets — NFR-3.7). Avoid `READ_MEDIA_IMAGES` unless needed. [V]
8. App lock: `expo-local-authentication` (dev build, `NSFaceIDUsageDescription`); a biometric boolean isn't cryptographic proof — bind secrets via SecureStore `requireAuthentication`. Root/jailbreak detection is best-effort only; server stays authoritative (Play Integrity / App Attest = a decision, §9). [V / U]
9. HTTPS only; no PII/tokens/ticket codes in logs or analytics; strip PII in Sentry `beforeSend`; wrap `console` in a `logger`. [U]

## 7. Offline-first, camera, crypto

**Offline**
1. Open the DB once; `PRAGMA journal_mode = WAL`; migrate with `PRAGMA user_version`. Use the **async** API near UI; prepared statements; bulk insert (50k rows) in one `withExclusiveTransactionAsync`; index lookup columns; `getEachAsync` for scans. FTS only if needed (build-time plugin flag). Benchmark 50k rows on a low-end phone. [V / U timing]
2. **Outbox:** write the admission **and** the outbox row in one transaction *before* any network call or success UI; client-UUID idempotency key (plus `(device_id, client_seq)` for the batch endpoint); state + attempts + exponential backoff with jitter; delete only after server ack; process in order per entity. Never in memory or AsyncStorage. [U]
3. Persist the server-clock offset on every successful call; stamp events with device time + offset; never trust device clocks for expiry/order. [U]
4. Flush on `AppState` active and on connectivity change, but treat a request failure as authoritative (connectivity flags lie). `expo-background-task` is opportunistic only (Android ≥15 min, iOS system-scheduled, killed on swipe-away, not on iOS simulators). [V]

**Camera**
1. `expo-camera` `CameraView` with `barcodeScannerSettings={{ barcodeTypes: ['qr'] }}` (the main perf win). `onBarcodeScanned` has no frequency limit → ref lock + cooldown + payload de-dupe; pass `undefined` handler while processing. Unmount the camera on blur (one preview at a time). `enableTorch`, permission in context with a "open Settings" path. [V]
2. `useKeepAwake()` while scanning; haptics (`expo-haptics`) + beep (`expo-audio`, `playsInSilentMode`, `interruptionMode`). Escalate to Vision Camera only if device testing shows scan speed/low-light problems. [V / U haptics]
3. A scanned code is untrusted until verified cryptographically (§ below) — never show success on decode alone. [U]

**Crypto on Hermes**
1. Ed25519 verify with `@noble/curves` (ESM-only v2, `.js` import suffix — confirm Metro resolution). Polyfill `crypto.getRandomValues` before import if needed. Pick strictness to match the server (`zip215: false` for RFC 8032). Warm up (one-time ≥20 MB precompute) off the critical path and measure memory. [V]
2. **scrypt N=8192 may be too slow in JS on low-end Android.** Benchmark `@noble/hashes` `scryptAsync` on a cheap phone before committing; fallback `react-native-quick-crypto`. `expo-crypto` has no scrypt. Validate against the KAT in `docs/MOBILE_APP_REQUIREMENTS.md` FR-3.15. [V/U — open risk]
3. Constant-time compare in JS is best-effort: XOR-accumulate over equal-length byte arrays. [V]

## 8. Platform integration, release, quality

1. **Push:** dev build only (no remote push in Expo Go on Android). Create an Android channel first; ask permission *in context* (after first booking); re-register the token on launch/login, delete on logout; handle taps with `useLastNotificationResponse()` + Router, allow-list routes. Token type: Expo push service (simple) vs native FCM/APNs device token (direct) — see §9. [V / U]
2. **Links:** iOS `associatedDomains` + AASA (HTTPS, ≤128 KB, refreshed only on install/update); Android `intentFilters` + `autoVerify` + `assetlinks.json` with the Play-signing SHA-256. Both need web-side hosting (BACKEND_STATUS §9). [V]
3. **Payments:** `openAuthSessionAsync` (ASWebAuthenticationSession / Custom Tabs). The return is never proof of payment — confirm via status/verify, survive app kill, resume by reference. [V / U]
4. **EAS:** `development` / `preview` / `production` profiles each bound to an EAS environment; secret vars never reach the client; `fingerprint` runtime-version policy; test OTA on a `preview` channel first; know `eas update:rollback`; server-driven min-version gate with a blocking screen (OTA can't fix native incompatibility). [V / U]
5. **Testing pyramid:** many pure-logic Jest tests (domain code, TDD) → moderate RNTL component/hook tests (`jest-expo`; query by role/label; MSW at the network boundary) → few Maestro flows (sign-in, scan, check-in, book, pay). Avoid snapshot tests. Router: `expo-router/testing-library`. [V / U]
6. **Lint/format/CI:** `npx expo lint` (includes compiler rules) + react-hooks + typescript-eslint + `import/no-cycle` + import ordering; one formatter (Prettier default; Biome/oxlint later). Every PR: `npx tsc --noEmit`, `npx expo lint`, tests, `npx expo-doctor`, Supabase types drift check; EAS preview build; pre-commit lint-staged. [V compiler rules / U]
7. **Observability:** `@sentry/react-native` via `npx expo install` (not deprecated `sentry-expo`), config plugin + `getSentryExpoConfig()`, source-map upload token only in EAS secrets; EAS Observe for startup/nav metrics. [V]
8. **Dependencies:** `npx expo install` only; prefer Expo modules; reject libs without recent releases / New Architecture support (check reactnative.directory); native-code libs need a dev build; never hand-edit `ios/`/`android/`. [V AGENTS.md]
9. **Git:** Conventional Commits (`feat(gate): …`), small PRs, PR checklist (a11y, tests, screenshots for UI).

## 9. Decisions and items to verify

| Item | Recommended default / action |
|---|---|
| Local DB | `expo-sqlite` + SQLCipher + WAL (avoid op-sqlite alongside it) |
| Network state | Confirm NetInfo vs `expo-network` (neither verified; NetInfo not in package.json) |
| Scanner | `expo-camera`; Vision Camera only if device tests fail |
| scrypt | **Benchmark first** on a low-end Android; fallback `react-native-quick-crypto` |
| Push route | Expo push service for simplicity; native tokens if we need direct sends — **also needs backend REQ-5 either way** |
| Styling | StyleSheet + tokens |
| Validation | zod |
| Client state | Zustand (UI) + Context (session/theme) |
| Lists | FlashList v2; benchmark vs LegendList on the roster |
| i18n | i18next + expo-localization |
| E2E | Maestro |
| Runtime version | `fingerprint` |
| Device integrity | Decide Play Integrity / App Attest per risk (native module + server check) |
| Boundaries | `no-restricted-imports` from the start |

**Verify before coding:** TS 6 compiler defaults; React Compiler behaviour on SDK 57 (the fetched page covers SDK 52–55); SecureStore option names and enrolment-change behaviour; 50k-row SQLite timings; scrypt timing; whether noble needs explicit sha512 wiring; `expo-haptics`, `expo-network`, NetInfo APIs; Reanimated 4.5 flag availability; FlashList v2 `estimatedItemSize` status; the exact Supabase RN storage-adapter code.
