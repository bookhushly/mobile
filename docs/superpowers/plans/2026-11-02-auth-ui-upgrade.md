# Auth UI upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's fonts with Hanken Grotesk and rebuild the six auth screens as a full-bleed photo welcome with white form sheets sliding over the same photo.

**Architecture:** One `AuthBackdrop` in `src/app/(auth)/_layout.tsx` draws the photo behind a transparent Stack with no native animation, so the photo never moves between auth routes. Screens animate their own content: Welcome draws over the photo, and form screens use a new `AuthSheet` that replaces `Screen` and slides up with transforms only. Pure offset and cycling logic lives in `src/features/auth/domain/authBackdrop.ts`.

**Tech Stack:** Expo SDK 57, expo-router 57.0.29, RN 0.86.3, Reanimated 4.5.1, expo-image, expo-linear-gradient (new), `@expo-google-fonts/hanken-grotesk` (new).

**Spec:** `docs/superpowers/specs/2026-11-02-auth-ui-upgrade-design.md`

## Global Constraints

- Hanken Grotesk everywhere: headlines weight 600 at about -2% spacing, form field labels 500, buttons and links 600, body and inputs 400.
- Web stays on Radio Canada; never edit `../web`. Reading `web/public/logo-wordmark.png` to copy it is fine.
- No auth behaviour changes except the two new back buttons: validation, error copy, retry and cooldown rules, existing navigation targets and session handling stay.
- Tokens only (no raw hex in `src/` outside theme files), never `fontWeight`, animate only `transform` and `opacity`, durations from `motion` tokens, every animation reads `useMotionTier()`.
- Keep `CodeScreen`'s `autoFocus`. Keep every existing `maxScale`; add no new caps.
- Install with `npx expo install`. Fonts and the gradient are native, so **a new dev build is required**.
- Commits: specific paths only, no Claude co-author trailer (owner rule, enforced by `.githooks`). Leave the already-dirty `CLAUDE.md` hunk and `.claude/skills/update-docs/` out of commits unless Task 6 edits that file; then review the diff with the owner's existing change in it.
- Before done: `npx tsc --noEmit`, `npx expo lint`, `npx jest` all pass.

## Review Focus

- Reduce Motion is on: the welcome photo never cycles and the sheet appears without sliding (tests in Tasks 2, 4).
- The app goes to the background on Welcome and returns: cycling stops, then resumes, with no burst of skipped changes (test in Task 2).
- The keyboard is already open when a screen mounts, as on the email code screen with `autoFocus`: the sheet starts in its raised position (test in Task 4).
- A person taps "Sign in" while the keyboard is open, or text is at maximum scale on a small phone: the tap lands and everything can be scrolled to (test in Task 4).
- Someone reaches new password or code from a link, never passing Welcome: the default hotel photo shows and the screen works; a render error shows an opaque error screen rather than text on the photo (tests in Tasks 2, 5).

---

### Task 1: Hanken Grotesk across the app

**Files:**
- Create: `assets/fonts/HankenGrotesk_400Regular.ttf`, `_500Medium.ttf`, `_600SemiBold.ttf`
- Delete: `assets/fonts/RadioCanada_*.ttf`, `assets/fonts/SourceSerif4_*.ttf`
- Modify: `package.json`, `app.json:47-56`, `src/shared/theme/fonts.ts`, `src/shared/theme/type.ts`, `src/shared/ui/Input.tsx:45`, `src/shared/ui/CodeField.tsx:35`, `src/shared/ui/PinField.tsx:25`
- Test: `src/shared/theme/__tests__/fonts.test.ts`, `src/features/customer/screens/__tests__/CheckInCodeScreen.test.tsx:58`

**Interfaces:**
- Produces: `FontKind = 'sans'`; `fontFamily(kind, weight)` keeps its signature; new variant `fieldLabel`.

- [ ] **Step 1: Create the branch.** Use the branch base the owner chose at handoff: `git switch -c feat/ui-auth-upgrade <base>`.

- [ ] **Step 2: Write the failing tests.** In `fonts.test.ts`, keep the "distinct family per weight" test, delete the serif test, and add:

```ts
it('uses Hanken Grotesk (iOS PostScript names in the jest default platform)', () => {
  expect(fontFamily('sans', 400)).toBe('HankenGrotesk-Regular');
  expect(fontFamily('sans', 500)).toBe('HankenGrotesk-Medium');
  expect(fontFamily('sans', 600)).toBe('HankenGrotesk-SemiBold');
});
it('recipe B: display variants are sans 600 at -2%', () => {
  for (const name of ['displaySm', 'display', 'displayLg', 'hero'] as const) {
    const v = typeVariants[name];
    expect(v.font).toBe('sans');
    expect(v.weight).toBe(600);
    expect(v.letterSpacing).toBeCloseTo(v.size * -0.02);
  }
  expect(typeVariants.fieldLabel.weight).toBe(500);
  expect(typeVariants.label.weight).toBe(600);
});
```

Change `CheckInCodeScreen.test.tsx:58` to expect `HankenGrotesk-SemiBold`.

- [ ] **Step 3: Run them to confirm they fail.** Run: `npx jest src/shared/theme/__tests__/fonts.test.ts`. Expected: FAIL on the family name.

- [ ] **Step 4: Swap the font files.** `npx expo install @expo-google-fonts/hanken-grotesk`; copy the three weights from `node_modules/@expo-google-fonts/hanken-grotesk/{400Regular,500Medium,600SemiBold}/` to `assets/fonts/`; list them in the `expo-font` plugin in `app.json` in place of the five old files; `npm uninstall @expo-google-fonts/radio-canada @expo-google-fonts/source-serif-4` after confirming nothing in `src/` imports them.

- [ ] **Step 5: Update the theme.** In `fonts.ts`, Android names are `HankenGrotesk_400Regular`, `_500Medium`, `_600SemiBold` and iOS names are `HankenGrotesk-Regular`, `-Medium`, `-SemiBold`; remove `serif`. In `type.ts`: `FontKind = 'sans'`; `displaySm` becomes 32/36 at -0.64 (tighter line height, matching the approved mockup); `display` -0.8; `displayLg` -0.96; `hero` -1.28; all four `font: 'sans'`, `weight: 600`, other values unchanged. Add `fieldLabel: { font: 'sans', weight: 500, size: 14, lineHeight: 20, letterSpacing: 0, maxScale: 1.6 }`. Reword the serif comment on `outcome`. Point the labels in `Input`, `CodeField` and `PinField` at `fieldLabel`.

- [ ] **Step 6: Verify.** Run: `npx tsc --noEmit && npx jest`. Expected: pass, with any other failing font-name assertions updated.

- [ ] **Step 7: Commit.** `git add` the paths above; message `feat(theme): replace Radio Canada and Source Serif with Hanken Grotesk`.

### Task 2: The photo behind the auth stack

**Files:**
- Create: `assets/images/auth/{hotel,event,apartment}.webp`, `assets/images/auth/SOURCES.md`, `src/features/auth/domain/authBackdrop.ts`, `src/features/auth/components/AuthBackdrop.tsx`
- Modify: `src/app/(auth)/_layout.tsx`
- Test: `src/features/auth/domain/__tests__/authBackdrop.test.ts`, `src/features/auth/components/__tests__/AuthBackdrop.test.tsx`

**Interfaces:**
- Produces: `PHOTO_COUNT = 3`, `CYCLE_MS = 6000`, `nextPhotoIndex(i: number): number`, `<AuthBackdrop />` (no props; reads `usePathname()`, `useMotionTier()`, `AppState`).

- [ ] **Step 1: Fetch the photos.** Download from Unsplash with `?w=1080&q=70&fm=webp`: hotel `photo-1566073771259-6a8506099945`, event `photo-1514525253161-7a46d19cd819`, apartment `photo-1522708323590-d24dbb6b0267`. Each must be under 250 KB. Record source URLs and "Unsplash License, placeholder, owner will replace" in `SOURCES.md`. Index 0 is the hotel, which is the default photo.

- [ ] **Step 2: Write the failing tests.** Domain: `nextPhotoIndex(0)` is 1 and `nextPhotoIndex(2)` is 0. Component, using fake timers and mocking `usePathname` and `useMotionTier`, reading the current source from the image's `testID="auth-photo"`:
  - `cycles on /welcome`: photo changes after advancing `CYCLE_MS`.
  - `holds the photo off /welcome`: start on `/welcome`, advance once, switch the path to `/sign-in`, advance `CYCLE_MS * 3`; the photo stays the same.
  - `starts on the hotel photo on any route`: rendered on `/new-password`, it shows index 0.
  - `does not cycle when tier is none`.
  - `pauses in the background`: emit `AppState` `background`, advance, no change; emit `active`, advance one interval, exactly one change.

- [ ] **Step 3: Run them to confirm they fail.** Run: `npx jest src/features/auth`. Expected: FAIL, module not found.

- [ ] **Step 4: Implement `AuthBackdrop`.** An absolute-fill `expo-image` `Image`, `contentFit="cover"`, `transition={motion.duration.slow}`, no `recyclingKey`, hidden from accessibility (`accessible={false}`, `importantForAccessibility="no-hide-descendants"`). Backing colour is `color.inverse`, so a failed image is never white behind white text. Preload all three with `Image.loadAsync` on mount, ignoring failures.

- [ ] **Step 5: Wire the layout.** Inside `DensityProvider`, render `<AuthBackdrop />`, then the `Stack` wrapped in expo-router's `ThemeProvider` with `{...DefaultTheme, colors: {...DefaultTheme.colors, background: 'transparent'}}`. Stack options: `headerShown: false`, `animation: 'none'`, `contentStyle: { backgroundColor: 'transparent' }`. Set `<StatusBar style="light" />` for the group. Keep the `ErrorBoundary` export, and confirm `ScreenError` paints an opaque background.

- [ ] **Step 6: Verify the risky part on a device before building on it.** Build a dev client and put plain coloured placeholder text on two auth routes. Docs could not confirm this. On iOS and Android, check: the photo shows through both routes; pushing and going back does not flash or move the photo; there is no black shadow during an iOS edge-swipe back. If the swipe misbehaves with `animation: 'none'`, disable `gestureEnabled` only if the spec's back buttons cover the exit. **If the photo cannot show through on a platform, stop and report to the owner**; do not silently change the continuous design.

- [ ] **Step 7: Run the tests and commit.** Run: `npx jest src/features/auth`. Expected: PASS. Message: `feat(auth): shared cycling photo behind the auth stack`.

### Task 3: Welcome screen

**Files:**
- Create: `assets/images/logo-wordmark.png` (copy of `../web/public/logo-wordmark.png`)
- Modify: `src/features/auth/screens/WelcomeScreen.tsx`, `src/features/auth/components/TermsLine.tsx`, `src/shared/ui/TextLink.tsx`, `src/shared/ui/Button.tsx:36-39`, `src/shared/theme/tokens.ts`, `src/shared/theme/theme.ts`, `src/shared/ui/Illustration.tsx` (only if `welcome` is now unused)
- Test: `src/features/auth/screens/__tests__/WelcomeScreen.test.tsx`, `src/shared/theme/__tests__/contrast.test.ts`

**Interfaces:**
- Produces: `TextLink` prop `tone?: 'link' | 'onInverse'` (default `link`); `TermsLine` prop `inverse?: boolean`; `Button` `variant="ghost" onInverse="light"` has no border; theme role `color.scrim: readonly [string, string, string]`.

- [ ] **Step 1: Write the failing tests.** Keep all three existing Welcome tests unchanged: "Sign in" must stay role button, after "Create account". Add:

```ts
it('states all three categories and the naira line', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.getByRole('header', { name: 'Events, stays and hotels across Nigeria.' })).toBeTruthy();
  expect(screen.getByText('Find it, book it, pay in naira.')).toBeTruthy();
  expect(screen.getByLabelText('Bookhushly')).toBeTruthy();
});
```

In `contrast.test.ts`, the lightest fade stop that sits behind text (60% alpha over pure white):

```ts
expect(contrastRatio('#FFFFFF', '#6C6A78')).toBeGreaterThanOrEqual(4.5);
```

- [ ] **Step 2: Run them to confirm the Welcome test fails.** Run: `npx jest WelcomeScreen`. Expected: FAIL on the headline.

- [ ] **Step 3: Add the tokens and inverse props.** Add palette values `scrimClear: 'rgba(10,6,30,0)'`, `scrimMid: 'rgba(10,6,30,0.6)'`, `scrimEnd: 'rgba(10,6,30,0.85)'` and the `color.scrim` role. Add the `TextLink` tone, the `TermsLine` inverse (captions and links use `onInverse`), and the borderless ghost case in `Button`'s `look()`. No existing code uses ghost with `onInverse`.

- [ ] **Step 4: Rebuild `WelcomeScreen`, same props.** `npx expo install expo-linear-gradient`. Render a transparent full-height `View`, without `Screen`: a `LinearGradient` absolutely anchored to the bottom at 65% height, `colors={color.scrim}`, `locations={[0, 0.25, 1]}`; the white wordmark at top-left below the safe area, 24 pt tall, `tintColor` white, label "Bookhushly", role image; then a bottom-anchored stack with safe-area padding and the phone gutter: `accountDeleted` banner (if any), headline `displaySm` in `onInverse` with role header, subline `body` in `onInverse`, `Button` primary `onInverse="light"` "Create account", `Button` ghost `onInverse="light"` "Sign in", `<TermsLine inverse />`. Fade the stack in on mount with opacity over `motion.duration.moderate`, skipped when the tier is `none`.

- [ ] **Step 5: Verify and commit.** Run: `npx tsc --noEmit && npx jest`. Expected: pass. Remove the `welcome` illustration if a grep shows nothing else uses it. Message: `feat(auth): full-bleed welcome screen`.

### Task 4: `AuthSheet`

**Files:**
- Create: `src/features/auth/components/AuthSheet.tsx`
- Modify: `src/features/auth/domain/authBackdrop.ts`
- Test: `src/features/auth/domain/__tests__/authBackdrop.test.ts`, `src/features/auth/components/__tests__/AuthSheet.test.tsx`

**Interfaces:**
- Consumes: `motion`, `useMotionTier`, `space`, `radius.r4`, `useWide`, `layout`.
- Produces: `type SheetBand = 'short' | 'medium' | 'tall'`; `BAND_PT = { short: 72, medium: 120, tall: 160 }`; `sheetOffset(band: SheetBand, topInset: number, keyboardOpen: boolean): number`; and `<AuthSheet band onLeave? leaveIcon? leaveLabel? footer? children />`, where `onLeave` is optional, `leaveIcon` defaults to `ArrowLeft` and `leaveLabel` defaults to `"Back"`.

- [ ] **Step 1: Write the failing tests.** Domain: `sheetOffset('short', 50, false)` is 122; `sheetOffset('tall', 50, false)` is 210; `sheetOffset('tall', 50, true)` is 50. Component, with `Keyboard` and `useMotionTier` mocked:
  - `renders children and footer`.
  - `shows the leave button only with onLeave`: label "Back" and `onLeave` fires on press.
  - `honours leaveIcon and leaveLabel`: label "Cancel".
  - `keeps taps working while the keyboard is open`: the `ScrollView` has `keyboardShouldPersistTaps: 'handled'`.
  - `starts raised when the keyboard is already open`: with `Keyboard.isVisible()` true at mount, `testID="auth-sheet"` has the `sheetOffset(..., true)` translateY.
  - `skips the slide at tier none`: the initial transform is the final offset.

- [ ] **Step 2: Run them to confirm they fail.** Run: `npx jest AuthSheet authBackdrop`. Expected: FAIL.

- [ ] **Step 3: Implement.** The sheet is an `Animated.View` with absolute top, left and right, height of the full window, `color.surface`, top radii `radius.r4`, `borderCurve: 'continuous'`, `translateY` a shared value. It enters from the window height with `withSpring(offset, motion.spring.sheet)`, or goes straight to the offset at tier `none`. Inside: a `ScrollView` with `keyboardShouldPersistTaps="handled"`, `automaticallyAdjustKeyboardInsets`, and content matching `Screen`'s body (gutter, `s5` gap, form max width). Set `paddingBottom` to the current offset plus the bottom safe inset plus `s5`, so the part of the sheet below the screen edge never hides content. The footer renders at the end of the scroll content. Use `useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 }` as `Screen` does. Listen to `keyboardWillShow/Hide` on iOS and `keyboardDidShow/Hide` on Android, and read `Keyboard.isVisible()` on mount. If events never fire on Android 10 and below, the sheet stays put and the `ScrollView` still reaches everything. Leave button: `IconButton variant="plain"` above the sheet at the top inset plus `s2`. Set `<StatusBar style="dark" />` while raised.

- [ ] **Step 4: Run the tests and commit.** Run: `npx jest AuthSheet authBackdrop`. Expected: PASS. Message: `feat(auth): AuthSheet with keyboard-aware offset`.

### Task 5: Move the five forms onto the sheet

**Files:**
- Modify: `src/features/auth/screens/{SignInScreen,SignUpScreen,CodeScreen,ForgotPasswordScreen,NewPasswordScreen}.tsx`, `src/app/(auth)/sign-up.tsx`, `src/app/(auth)/code.tsx`
- Test: the matching files in `src/features/auth/screens/__tests__/`

**Interfaces:**
- Consumes: `AuthSheet`, `SheetBand`.
- Produces: `SignUpScreen` and `CodeScreen` gain `onBack?: () => void`.

- [ ] **Step 1: Write the failing tests.** Add `shows Back and calls onBack` to `SignUpScreen.test.tsx` and `CodeScreen.test.tsx`, using `getByRole('button', { name: 'Back' })`. Add to `NewPasswordScreen.test.tsx`: `keeps Cancel, not Back`.

- [ ] **Step 2: Run them to confirm they fail.** Run: `npx jest src/features/auth/screens`. Expected: FAIL on Back.

- [ ] **Step 3: Swap `Screen` for `AuthSheet`.** Bands: sign up `short`; sign in `medium`; code, forgot and new password `tall`. Remove each screen's `header` and its now-unused imports; pass the existing `onBack` as `onLeave`; new password uses `onLeave={onLeave} leaveIcon={X} leaveLabel="Cancel"`. All copy, fields, banners and handlers stay the same. Sign up keeps all five rules through the existing `RuleList`.

- [ ] **Step 4: Add the two back routes.** In `sign-up.tsx` and `code.tsx`: `onBack` calls `router.back()` if `router.canGoBack()`, otherwise `router.replace('/welcome')`, the pattern `code.tsx` already uses for `onChangeEmail`.

- [ ] **Step 5: Run the tests and commit.** Run: `npx tsc --noEmit && npx jest src/features/auth`. Expected: PASS with all existing screen tests unchanged. Message: `feat(auth): form screens on the photo sheet, back on sign up and code`.

### Task 6: Docs and device pass

**Files:**
- Modify: `CLAUDE.md`, `docs/DESIGN_SYSTEM.md`, `docs/MOBILE_APP_REQUIREMENTS.md`, `docs/ENGINEERING_STANDARDS.md`, `.claude/rules/design-system.md`, `.claude/rules/components-ui.md`, `.claude/agents/ux-design-reviewer.md`

- [ ] **Step 1: Update the docs.** Fonts row, type table and §3 notes; remove the serif rules and resolve D7 and D8. Add the glyph note: no ₦, ṣ or Ṣ, which fall back to the system font, and digits are all 560 units wide, so numbers are tabular without `tnum`. Record that the owner chose this deliberately over the earlier glyph-coverage reason, because the look comes first. Allow one gradient: the photo legibility fade. Note that auth photos are brand imagery, never inventory. Fix `docs/ENGINEERING_STANDARDS.md` where it names the fonts. Leave dated plans and specs alone. Log nothing in `BACKEND_STATUS`; this has no backend impact.

- [ ] **Step 2: Run the full gate.** Run `/verify`. Expected: typecheck, lint, tests and doctor all pass; report any failure honestly.

- [ ] **Step 3: Run the specialist reviews.** Dispatch `ux-design-reviewer` and `rn-code-reviewer` on the branch, and `perf-auditor` for the backdrop images. Fix real findings.

- [ ] **Step 4: Do the device pass in a new dev build, and write the results to the owner.** On a small Android phone and an iPhone:
  - ₦ next to digits on a customer price screen. **If it looks wrong, ask the owner; do not decide.**
  - Recipe B at phone size.
  - White text over all three photos, especially the brightest.
  - Sheet with keyboard open, and at the largest OS text size on sign up.
  - Email code arrival with the keyboard opening at once; one-time-code autofill and paste.
  - Gate outcome screens, scanner counter, receptionist rows and customer cards for truncation from the new font.
  - Reduce Motion on.

- [ ] **Step 5: Commit the docs.** Stage the listed paths only, and show the owner the `CLAUDE.md` diff, which already holds an uncommitted change of theirs. Message: `docs: Hanken Grotesk and auth photo rules`.
