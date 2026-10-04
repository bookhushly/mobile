# Motion system

Researched 2026-10-04 for Expo SDK 57 / RN 0.86 / Reanimated 4.5.1 / Hermes. **Rule of thumb: motion must earn its place and must never cost performance.** Design tokens are in `docs/DESIGN_SYSTEM.md`. **[V]** = verified against a fetched source, **[U]** = not verified (own recommendation or unconfirmed). Budget numbers marked "own" need validation on a real low-end Android phone.

## 1. Verified facts

- SDK 57's pinned versions [V, `expo/expo` sdk-57 `bundledNativeModules.json`]: `lottie-react-native ~7.3.8`, `react-native-reanimated 4.5.1`, `react-native-worklets 0.10.1`, `react-native-gesture-handler ~2.32.0`, `@shopify/react-native-skia 2.6.2`. Lottie is a supported third-party module, not an Expo module (no Expo docs page). Install: `npx expo install lottie-react-native`; needs a dev build (Expo Go [U]).
- npm latest is 7.5.0 (needs react ≥19.2, RN ≥0.84; 8.0.0-rc exists) — **don't go past the Expo pin without a reason** (D1).
- Native engines (7.5.0): lottie-android 6.7.1, lottie-ios 4.6.0; Fabric supported (podspec depends on `React-RCTFabric`).
- Props [V, api.md]: `source`, `autoPlay [false]`, `loop [true]`, `speed`, `progress` (number, Animated or Reanimated value), `resizeMode`, `renderMode [AUTOMATIC | HARDWARE | SOFTWARE]`, `cacheComposition [true, Android]`, `colorFilters`; methods `play/pause/resume/reset`; `onAnimationFinish` fires only when `loop={false}`. Prefer `renderMode` (the README also lists `hardwareAccelerationAndroid`; `api.md` does not).
- **`.lottie` (dotLottie) on native in 7.3.8 is UNVERIFIED** (the package depends on a web dotLottie lib; a search result said 7.4.0 added support). Test on device before committing to `.lottie`; otherwise ship optimised `.json`.
- Rive's new `@rive-app/react-native` (Nitro rewrite) is a **development preview** (Margelo benchmark: 29 ms vs 2,716 ms loading 24 views; 112 MB vs 525 MB) [V]. Not for v1 unless the owner accepts that (D3).
- Not fetched / unverified: Reanimated 4 CSS animations/transitions API (read the v4 docs before adopting), Apple HIG Motion, M3 token page (durations/easings below come from the M3 Android docs [V]).

## 2. How Lottie costs you

- iOS: Core Animation engine by default (animates on the render server); falls back to the Main Thread engine for unsupported features. Android: drawn on the UI thread. **Neither runs on the JS thread** — JS cost is asset load + JSON parse + any `progress` driving. Never drive `progress` from React state; use a Reanimated shared value.
- Expensive AE features [V, airbnb/lottie docs]: Android masks/mattes (cost scales with intersection bounds; hardware rendering gives a "several X" gain for them), merge paths (`Path.Op`), blur/drop shadow (per fill/stroke on Android; unsupported on iOS Core Animation), expressions (unsupported), large embedded rasters (memory/decode [U]). Hardware rendering is off by default on lottie-android (no anti-aliasing, can be slower) — **benchmark each asset in both modes on a low-end phone**.
- Caching: Android keeps an LRU composition cache. A bundled asset is parsed on first mount; I couldn't verify a `preload()` API → pattern: mount hidden at opacity 0 at screen mount [U].
- Lifecycle (own): unmount when offscreen; pause on `AppState !== 'active'` and when the screen loses focus (`useFocusEffect`); prefer `loop={false}` + `onAnimationFinish`; loops only for loading/pending, capped (≤3 repeats or ≤5 s).
- Asset spec (own): vector only, no raster; 512 px comp, 30 fps, ≤3 s one-shot; no expressions/merge paths/blur/heavy mattes; delete hidden layers; simplify paths; run the LottieFiles optimiser; test SOFTWARE vs HARDWARE on device.
- **Never use Lottie for the gate scan outcome** (<100 ms requirement; first-frame latency unverified). Static colour + vector icon via Reanimated/plain Views; an optional <400 ms flourish only _after_ the colour is already on screen.

## 3. Decision matrix

| Use case                   | Tech                                                  | Notes                                                   |
| -------------------------- | ----------------------------------------------------- | ------------------------------------------------------- |
| Skeleton/loading           | Reanimated opacity pulse, one shared value per screen | no asset                                                |
| Booking success (customer) | Lottie one-shot ≤30 KB + static fallback              | finite                                                  |
| Onboarding / empty states  | Lottie (Rive only if state machines needed)           | illustrative                                            |
| Press feedback             | Reanimated spring on scale/opacity + haptic           | UI thread                                               |
| Screen transitions         | Expo Router native stack defaults                     | free                                                    |
| List entrance              | Reanimated `entering`, first screenful only, ≤6 items | layout animations are costly in long lists              |
| Pull-to-refresh            | native `RefreshControl`                               |                                                         |
| Ticket countdown ring      | Skia/SVG driven by one shared value                   | vector maths, not Lottie; add Skia only if truly needed |
| Payment pending            | Lottie loop or Reanimated spinner + copy              | pause offscreen                                         |
| **Scan outcome**           | **static colour + icon, no Lottie**                   | <100 ms                                                 |

Reanimated recommends moving to Skia past ~100 animated components on low-end Android [V].

## 4. Motion tokens

Durations (aligned to the M3 scale [V]): `instant` 0 (gate outcome, reduced motion) · `fast` 100 (press, toggle) · `base` 150–200 (fades, small shifts) · `moderate` 300 (sheet, card enter) · `slow` 500 (hero/celebration, customer only).

Easing (M3 [V]): standard `cubic-bezier(0.2, 0, 0, 1)` · decelerate/enter `(0.05, 0.7, 0.1, 1)` · accelerate/exit `(0.3, 0, 0.8, 0.15)` · linear `(0,0,1,1)` (loops only).

Springs (own starting values — tune on device): press `{damping 20, stiffness 400, mass 0.6}` · sheet `{damping 28, stiffness: 260, mass 1}` · playful `{damping 14, stiffness 180, mass 1}` (customer only). `overshootClamping: true` in gate/receptionist. Reanimated's default entering/exiting is 300 ms quad ease — override with tokens.

Choreography: exit ≈70 % of enter; one thing moves at a time, parent then children; stagger 30–40 ms, ≤6 items, total <250 ms, first mount only (never on refetch).

**Must NOT animate:** gate outcome appearance, scan counters, error/validation text, anything on a list row during scroll.

## 5. Performance budget

| Metric                                                       | Budget                           | Basis                     |
| ------------------------------------------------------------ | -------------------------------- | ------------------------- |
| Frame                                                        | 16.6 ms (60 Hz), 8.3 ms (120 Hz) |                           |
| Simultaneous Reanimated-animated components, low-end Android | ≤100 (iOS ≤500)                  | [V] Reanimated perf guide |
| Concurrent Lottie views                                      | 1 (max 2 in customer tier)       | own                       |
| Lottie size                                                  | JSON ≤50 KB; `.lottie` ≤30 KB    | own                       |
| Lottie comp                                                  | 512 px, 30 fps, ≤3 s one-shot    | own                       |
| JS thread during animation                                   | idle; no per-frame `setState`    |                           |
| Gate outcome latency                                         | <100 ms from scan                | requirement               |
| Idle gate scanner                                            | zero looping animation           | battery over a 6 h shift  |

Rules: animate **only `transform` and `opacity`** (never width/height/top/left/margin/padding); don't read shared values on the JS thread; use an animated `TextInput` for counters; memoise gestures; build layout-animation objects outside components. Reanimated flags for specific symptoms [V]: `DISABLE_COMMIT_PAUSING_MECHANISM` (scroll jitter, RN 0.81+), `USE_COMMIT_HOOK_ONLY_FOR_REACT_COMMITS` (scroll FPS, Reanimated 4.2+), `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` (many simultaneous animations).

**Measure:** release builds only; real low-end Android (not an emulator); Perf Monitor, Flashlight (Android), Android GPU profiling/systrace, Xcode Instruments; compare battery drain per hour with and without motion before shipping.

## 6. Adaptive tiers — `full | reduced | none`

A single `useMotionTier()` hook; **every animation reads it**.

- `none`: OS Reduce Motion on. `useReducedMotion` is read once at launch [V] — also subscribe to `AccessibilityInfo` `reduceMotionChanged` [U].
- `reduced`: Low Power Mode (`expo-battery` `useLowPowerMode` [V]) or low-end device (`expo-device` memory; `deviceYearClass` UNVERIFIED for SDK 57) — fades ≤200 ms, no Lottie, no stagger.
- Mode defaults: **customer = full**, **receptionist = reduced** (fades/100–200 ms, no Lottie), **gate = minimal** (colour swap + sound + haptic).
- Accessibility: WCAG 2.3.3 — interaction-triggered motion must be disableable [V]; no >3 flashes/s and a pause control for auto-motion >5 s [U thresholds]. **Haptics caveat [V]:** iOS Taptic Engine is silent in Low Power Mode, with haptics disabled, or while the camera is active — so at the gate **audio + colour + icon carry the result; haptics are a bonus**. Test on device.

## 7. Animation inventory (v1)

| #   | Animation                     | Tech                       | Duration      | Fallback              | Tier          |
| --- | ----------------------------- | -------------------------- | ------------- | --------------------- | ------------- |
| 1   | Scan admitted/refused overlay | static colour + icon       | 0–100 ms      | same                  | all           |
| 2   | Scan overlay auto-dismiss     | opacity                    | 150 ms        | instant               | all           |
| 3   | Button press                  | spring scale 0.97          | ~100 ms       | none                  | full, reduced |
| 4   | Skeleton shimmer              | opacity pulse              | 1.2 s loop    | static grey           | full          |
| 5   | Screen transitions            | Router defaults            | native        | native                | all           |
| 6   | List entrance (first 6)       | `entering`                 | 200 ms        | none                  | full          |
| 7   | Booking success               | Lottie one-shot ≤30 KB     | ~1.5 s        | static check + haptic | full          |
| 8   | Payment pending               | Lottie loop or spinner     | loop, 5 s cap | spinner               | full, reduced |
| 9   | Payment failure               | static icon + 200 ms shake | 200 ms        | static                | full          |
| 10  | Ticket live ring              | Skia/SVG, one shared value | 1 s tick      | static ring           | full          |
| 11  | Ticket QR reveal              | fade                       | 200 ms        | instant               | full, reduced |
| 12  | Empty states                  | Lottie one-shot            | ~2 s          | static illustration   | full          |
| 13  | Onboarding                    | Lottie (Rive if accepted)  | 2–3 s         | static                | full          |
| 14  | Bottom sheets                 | spring                     | 300 ms        | fade                  | full, reduced |
| 15  | Toast/banner                  | slide + fade               | 200 ms        | fade                  | all           |

Assets: LottieFiles library (**check each licence individually — terms unverified**) or custom After Effects/Bodymovin in brand violet `#7C3AED` to the §2 spec; commission 3–5 assets.

## 8. Review/enforcement checklist

Reject: animating layout props; Lottie outside `assets/animations/` or over budget; per-frame `setState`; an animation that doesn't read the tier; Lottie on the gate outcome path; a looping animation that doesn't pause when unfocused/backgrounded; an animation PR without a device-profile note.

## 9. Decisions (2026-10-04)

| # | Decision | Outcome |
|---|---|---|
| M1 | Lottie version | **7.3.8** (the SDK 57 pin; stays `expo-doctor`-clean). Verify `.lottie` on a device before using it; otherwise ship optimised `.json`. Revisit 7.5.0 only if a concrete need appears. (Owner delegated; decided by Claude.) |
| M2 | Which animations get a Lottie asset | **Target Lottie slots: #7 booking success, #12 empty states, #13 onboarding (onboarding is a v1 must-have).** Per M6, v1 renders these with SVG + Reanimated first; the Lottie versions replace them when commissioned. #8 payment pending is a Reanimated spinner permanently. Add more Lottie only with a measured device result. |
| M3 | Rive | **Not in v1 — owner agreed.** Revisit after the customer phase with a one-asset pilot. See note below. |
| M4 | Receptionist `reduced` by default; gate minimal | **Yes** (no objection recorded) |
| M5 | Budget numbers | **Adopt as starting values; validate on a real low-end Android** |
| M6 | Asset sourcing + licence checks | **Decided (owner delegated, 2026-10-04): v1 ships code-built animation; Lottie assets are commissioned later.** Free libraries couldn't be verified or didn't fit (`docs/ASSET_LICENSES.md`). v1 onboarding, empty states and the success tick are built from `react-native-svg` + Reanimated, behind an `Illustration`/`SuccessMark` component API that can swap to a Lottie file later without touching screens. `lottie-react-native` is **not installed until the first commissioned asset arrives**, so v1 carries no Lottie dependency, licence or dev-build risk. The owner commissions the brand set (3–5 violet/ink vector Lottie files to the §2 spec) on their own timeline. |
| M7 | Low-end Android baseline + battery test | **Baseline device: Motorola Moto G06, 4 GB RAM, Android 15** (the owner's own phone). The owner runs release-build smoothness and battery checks; Claude supplies the checklist. Treat it as the floor: anything that stutters here is a bug. |

**Why not Rive in v1.** It isn't a performance objection: Margelo's benchmark shows the new Rive runtime loading 24 views in 29 ms vs 2,716 ms and using ~4x less memory (iPhone 13 mini, release). The reasons are maturity and cost: the new `@rive-app/react-native` is labelled a *development preview*; I didn't find it in the SDK 57 pinned-module list (so no Expo-tested version; not verified beyond that); it adds a second animation runtime and a separate asset pipeline (Rive editor, not After Effects) for assets we only need a couple of in v1. A one-asset pilot later is cheap and would settle it with data.
