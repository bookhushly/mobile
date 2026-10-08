# UI-A — Component kit, motion layer and gate redesign (design)

**Status:** approved in conversation 2026-10-08 · **Branch:** `feat/ui-a-foundation-gate` · **Follows:** Phase 2b (`2026-10-07-phase-2b-gate-lookup-override-design.md`) · **Precedes:** UI-B (entry flow, mode switcher, customer tour, native account screens) and Phase 3 (receptionist) · **Rules:** `docs/DESIGN_SYSTEM.md`, `docs/MOTION.md` · **References:** `docs/design-references/2026-10-08-ui-a-gate-mobbin.md` · **Audit:** findings summarised in §8.

## 1. Goal and success

Every screen a gate user sees after choosing gate mode is built from one shared, token-driven component kit and reads cleanly at a busy door: big targets, one status line, unmistakable outcomes. Receptionist (Phase 3) and customer (Phase 4) screens are then built straight on the kit, not redesigned later.

Done when: the kit in §3 exists with tests; the gate screens in §4 use only kit parts and semantic tokens; every audit finding in §8 is fixed or explicitly deferred; gate behaviour is unchanged except the deliberate changes in §5; `tsc`, lint and jest pass; the phone checklist's new "Redesign" section passes on the Moto G06 (sunlight, 200 % text, one-handed use).

## 2. Decisions

1. **Brand values equal the web's.** Violet `#7C3AED` (web `brand-600` and `--primary` 262 83 % 58 %), pressed / small violet text `#6D28D9` (`brand-700`), washes `#F4F1FF` / `#EBE5FF` (`brand-50/100`), ink `#1A0D4D` (web `--foreground` 252 71 % 18 %). Verified against `../web/tailwind.config.js` and `app/globals.css` on 2026-10-08. A test pins these hex values so a drift fails CI.
2. **Density is context, not props.** A `DensityProvider` wraps each mode's route group (gate → `gate`, receptionist → `work`, customer and auth → `customer`). Button, Input, ListRow, IconButton and Sheet read sizes from it. Gate: controls 64, targets ≥ 48 with hitSlop to 56, gap ≥ 16.
3. **Amber means "Already used" and nothing else.** A fixable refusal (code expired, ask for the live ticket) becomes a red **Refused** with an instruction line and the error cue. Four outcomes, four colours, four icons.
4. **One status pill replaces the sync bar's links.** It shows the single most important state and opens Activity; Refresh list and Sync now move into Activity.
5. **The scanner has three bottom controls** (Torch, Find guest, Enter code). Recent opens from the door counter.
6. **Mode switcher and sign-out move into an account sheet** opened from the event list header, which also shows who is signed in (FR-1.9).
7. **Camera permission is primed** by our own screen before the OS prompt, with a manual-entry path; the denied state reuses it with "Open settings".
8. **No new native dependency.** Reanimated 4.5.1, react-native-svg 15.15.4, lucide, expo-haptics are already installed. The low-power motion tier (`expo-battery`) is deferred until a device run shows a need. A new preview build is still made for the device check.
9. **Gate motion is minimal.** Nothing animates on outcomes, counters or the idle scanner. Allowed: press spring, sheet slide, skeleton pulse, all through `useMotionTier` and off under Reduce Motion.

## 3. Theme and kit

### 3.1 Theme additions (`src/shared/theme`)

- **Type:** `displayLg` 48/56 and `hero` 64/68 (serif 500; onboarding/display only); `outcome` 36/44 sans 600, `maxScale 1` (gate results). `numXl` keeps 64; add `numLg` 48/52 sans 600 tabular for the door counter.
- **Colour roles:** `inverse` surface (`#1A0D4D`) and `onInverse` text for the scanner; `Text` tones and `Box` backgrounds accept `status.{success,warning,danger,info,neutral}.{fg,bg,solid}` and `outcome.*`, removing inline `style={{ color }}` overrides.
- **Elevation:** levels 2–4 from DESIGN_SYSTEM §5 (ink-tinted shadow + Android elevation).
- **Sizes:** icon 16/20/24/32/96/128; border 1/2; tablet gutter 24 at ≥ 768; `borderCurve: 'continuous'` on iOS.
- **Motion:** durations `instant 0 · fast 100 · base 180 · moderate 300 · slow 500`; easings standard/decelerate/accelerate/linear; springs press/sheet/playful with `overshootClamping` in gate and work (MOTION §4).
- **Hygiene:** `palette` no longer exported from `theme/index.ts`; contrast test covers every pair in use (adds `status.*.fg` on surface, danger solid on surface, `linkText` on `selectedWash` and canvas, `onInverse` on inverse) plus the brand-parity pin (decision 1).

### 3.2 Kit (`src/shared/ui`)

| Part | Job |
|---|---|
| `DensityProvider`, `useDensity` | Density context (decision 2). |
| `Button` | `primary · secondary · ghost · destructive`; `onInverse` for coloured backgrounds; `busy` (spinner + label, not just opacity) and `disabled` (filled muted style readable in sun); full width; press spring. |
| `IconButton`, `ToggleButton` | Round icon controls, optional label under; `ToggleButton` has `accessibilityRole="switch"` and `checked`. |
| `TextLink` | Inline link, `#6D28D9`, ≥ 44 pt hit area. |
| `Input` | Label, hint, error linked for screen readers, left/right slots (clear, password reveal), density height. |
| `SearchField`, `PinField` | Search with clear; 6-box PIN with one hidden input, `oneTimeCode`-style autofill off. |
| `Screen`, `Header` | Header slot (title, left/right actions), scroll or fixed, sticky footer inset `max(inset, s5)`, tablet max width. |
| `Sheet` | Modal page sheet with header (title, close, optional right action), footer slot, keyboard handling; slide uses the sheet spring, fade under `reduced`, none under `none`. |
| `ListRow` | 1-/2-line, leading slot (icon, date tile, initials), trailing slot (pill, button, chevron), section header row. |
| `SegmentedControl` | Tabs with optional counts, `tablist`/`tab` roles. |
| `StatusPill` | `neutral · info · success · warning · danger`, optional icon; never violet. |
| `Banner` | `info · warning · danger · neutral` ("couldn't reach"), optional action. |
| `EmptyState`, `ErrorState` | Illustration/icon, one-line reason, optional "data safe" line passed in by the caller, one action. |
| `Skeleton`, `Spinner` | Skeleton appears after 150 ms, pulse only on `full`; static on `reduced`/`none`. |
| `Illustration`, `SuccessMark` | Named SVG scenes (`camera`, `noEvents`, `offline`, `search`) and a check mark, react-native-svg + Reanimated, behind an API a Lottie file can replace (MOTION M6). Violet/ink/wash only. |
| `OutcomeScreen` | Moved from the gate feature into the kit (§4.4). |
| `useMotionTier` | `full · reduced · none`: Reduce Motion → `none` (subscribed to changes), else the mode default (customer `full`, work `reduced`, gate `none` for decorative motion while press feedback stays). |

`Box`, `Stack`, `Text`, `Card`, `Icon`, `Money` stay; `Icon` takes a colour role and the new sizes.

## 4. Gate screens

### 4.1 Event list
Header "Events" + account `IconButton` → account sheet (signed-in name and email, mode switcher as a segmented/radio group with one-line descriptions, Sign out with the existing sign-out guard and shift summary). Rows: date tile (month / day / weekday), title, "time · venue", `StatusPill` Live now (success) / Today (info) / Upcoming (neutral), and an "Offline list ready" mark when the phone holds that event's roster. "Earlier (n)" is a collapsible section header with `expanded` state. Loading: skeleton rows. Empty: `EmptyState` "No events assigned — ask the organiser" + Refresh. Error: `ErrorState` "Couldn't load events" + "Offline lists on this phone still work" when any roster exists + Try again. Dates format with `en-NG`.

### 4.2 Camera permission
Shown when the scanner opens and permission is undetermined, instead of firing the OS prompt on mount: `Illustration camera`, "Allow camera to scan tickets", "The camera is only used to read ticket codes. Nothing is recorded.", primary **Allow camera** (fires the OS prompt), secondary **Enter codes by hand** (opens Enter code; scanning by hand works without the camera). Denied: same screen, title "Camera is off for Bookhushly", primary **Open settings**, same secondary. Not focused / app inactive: the camera area shows "Camera paused".

### 4.3 Scanner
Full-bleed camera on `inverse`. Top bar: back `IconButton` (to the event list), event name (one line, truncated), mute `ToggleButton`. Under it: door counter (`numLg` count + "admitted", "of N" when the roster total is known, "offline" caption when local) — tapping it opens Recent; then the **status pill**, priority order: needs attention (warning, "N need attention") › clock suspect (warning, "Phone time changed") › syncing ("Syncing…") › offline ("Offline · N to sync") › downloading ("Downloading list 4,000 of 12,500") › online ("Online · list 2 min ago"). Tapping it opens Activity (on Needs attention when that is the state). Viewfinder brackets from tokens and the hint "Point at the ticket QR code". Bottom: Torch (`ToggleButton`), **Find guest** (centre, larger, primary), Enter code; 64 pt, ≥ 16 apart, bottom inset `max(inset, s5)`. The live region announces only when the pill's *state* changes.

### 4.4 Outcome screen
Full-screen solid fill, no animation, `maxScale 1`, one assertive announcement, content in the lower two-thirds:

| Outcome | Fill | Text | Icon (128) |
|---|---|---|---|
| Admitted | `#166534` | white | check |
| Already used | `#FBBF24` | ink | clock; time + who |
| Refused (incl. fixable) | `#991B1B` | white | x-octagon; reason; instruction for fixable |
| Couldn't check | `#4A4670` | white | refresh / wifi-off by cause |

Title in `outcome` (sans 36). Detail and secondary lines `title`/`body`. Tag ("Offline · will sync", "Lookup · will sync", "Override · will sync") as a pill on the fill. Actions: one large primary at the bottom (Scan next / Done / Try again / Dismiss; `onInverse` style); "Supervisor override" as an outline button above it when available; busy state visible ("Recording…" with spinner).

### 4.5 Sheets (all on `Sheet`)
- **Find guest:** `SearchField` at top; `SegmentedControl` "Not in (n) · In (n)"; rows: initials, name or masked phone, ticket type + number; trailing `StatusPill` "In · 22 min ago" or an **Admit** button (busy in place); not-confirmed bookings show their status pill, no button. Tapping a row pushes the booking view inside the sheet (back in the header). No roster → `EmptyState` "No offline list on this phone yet". Search error → `Banner` neutral "Couldn't search the list".
- **PIN:** `PinField`, approver `Input`, reason `Input` (optional for lookup), sticky Confirm; "Checking…" busy; wrong PIN / locked messages as danger `Banner`; "isn't available right now" as neutral `Banner`.
- **Enter code, Recent:** same structure; Recent rows grouped by time with "By me" as a neutral pill.

### 4.6 Activity
`Sheet` with header Close · "Activity" · **Export** (text action). Top card: "Offline list · 1,240 tickets · updated 2 min ago" + **Refresh list**. `SegmentedControl` To sync (n) · Needs attention (n) · Synced (n). Rows grouped by time: leading state icon, "VIP #3", "14:02 · Lookup" (mode as a neutral pill), trailing state pill, the 2a/2b state line under it for needs-attention rows. Sticky **Sync now** when To sync > 0. Export errors as `Banner`. Paging unchanged.

## 5. Deliberate behaviour and copy changes

Everything else keeps its current behaviour and wording; tests that change get a note in the plan.

1. Fixable refusals: amber → red Refused, warning cue → error cue (decision 3).
2. Sync bar → status pill + Activity; "Refresh list" / "Sync now" move into Activity (decision 4).
3. Recent moves from a bottom control to the door counter (decision 5).
4. Mode switcher and sign-out move into the account sheet (decision 6).
5. Camera permission is primed; the OS prompt no longer fires on mount (decision 7).
6. Transient-failure messages (sign-in network/429/5xx, PIN "isn't available", Find guest "Couldn't admit") use neutral styling; Find guest says "Not recorded — try again".
7. `ScreenError` stops asserting "Your data is safe" unless the caller passes a known fact.

## 6. Accessibility and motion

- Targets: gate ≥ 56 effective (64 visual for primary controls), elsewhere ≥ 44; ≥ 16 apart at the gate.
- Toggles are switches with `checked`; tabs use `tab`/`selected`; collapsible headers use `expanded`.
- Announcements: outcomes once (assertive; iOS `announceForAccessibility`); the status pill only on state change; form errors on submit.
- Large text: existing per-variant `maxScale` caps; gate bottom labels fit at 200 % (three controls); outcome screen fixed.
- Motion per decision 9; skeleton never animates under `none`/`reduced`; no idle animation on the scanner.

## 7. Testing

- Theme: contrast pairs and brand-parity pin; `useMotionTier` (Reduce Motion on/off, change event, mode defaults).
- Kit (RNTL v14, async): roles, labels, states (busy, disabled, checked, expanded, selected), density sizes under each provider, Skeleton 150 ms delay with fake timers, Sheet header/footer.
- Gate screens: camera permission (undetermined → allow / deny → open settings / manual), status pill priority order (one test per state), outcome screen fill + icon + title per outcome incl. fixable refusal, counter opens Recent, pill opens Activity on the right tab, account sheet sign-out still runs the guard.
- Existing gate tests keep their behaviour assertions; query changes only where §5 changes the UI.
- Reviews: `ux-design-reviewer`, `rn-code-reviewer`, `perf-auditor` (scanner and lists), final whole-branch review.
- Device: add a "Redesign" section to `docs/device-tests/2026-10-08-gate-phone-checklist.md` (sunlight legibility, 200 % text, one-handed reach, Reduce Motion, sheet keyboard on Android, scanner smoothness over 10 min).

## 8. Audit coverage

From the 2026-10-08 UI audit: serif outcome title (§4.4) · shared amber (§2.3) · sync bar size and live region (§4.3) · 20 px counter (§4.3) · no gate density (§2.2) · red transient failures (§5.6) · no camera priming (§4.2) · violet as status (§3.2 StatusPill, §4.6) · no motion layer (§3.2) · bare states (§3.2, §4.1) · palette export, contrast gaps (§3.1) · mode switcher placement (§4.1) · event list loading/empty/error/locale (§4.1) · `update-required` dead end and `mode-error` copy → **UI-B** (entry flow) · tablet two-pane (D10) → **Phase 3**.

## 9. Out of scope

Welcome, sign-in redesign, loading/mode screens, customer tour, native sign-up/code/reset/delete (UI-B; web asks in `../web/docs/mobile/NATIVE_AUTH_ASKS.md`) · receptionist screens (Phase 3) · Lottie assets (commissioned later, M6) · low-power motion tier.
