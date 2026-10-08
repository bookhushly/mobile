# UI-A — Component kit, motion layer and gate redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared, token-driven component kit (with density context and a motion tier) and redesign every gate screen on it, without changing gate behaviour except the deliberate changes in spec §5.

**Architecture:** Theme tokens grow (type, roles, elevation, motion, sizes) in `src/shared/theme`; the kit lives in `src/shared/ui` and never imports a feature. Density comes from a `DensityProvider` set per route group; `useMotionTier` derives `full | reduced | none` from Reduce Motion and density. Gate screens keep their logic and props and swap their hand-rolled views for kit parts; the only new gate domain code is `statusPill` (replaces `syncLine`) and `eventStatus`, plus `rosterStore.readyEventIds`.

**Tech Stack:** Expo SDK 57, RN 0.86, React 19.2 + React Compiler, Reanimated 4.5.1 (+ worklets 0.10.1), react-native-svg 15.15.4, lucide-react-native, Jest (jest-expo) + RNTL v14 (async API), TypeScript strict.

**Spec:** `docs/superpowers/specs/2026-10-08-ui-a-foundation-gate-design.md` (read it with this plan). References: `docs/design-references/2026-10-08-ui-a-gate-mobbin.md`, `docs/DESIGN_SYSTEM.md`, `docs/MOTION.md`.

## Global Constraints

- Brand values must equal the web's: violet `#7C3AED`, pressed/small violet text `#6D28D9`, washes `#F4F1FF` / `#EBE5FF`, ink `#1A0D4D`. A test pins them.
- Light UI only. Screens import semantic roles from `@/shared/theme` only, never `palette` (it is no longer exported from `theme/index.ts`).
- Hooks reject: `any`, `@ts-ignore`, `console.log`, raw hex outside `src/shared/theme/`, `fontWeight`, animated layout props (animate only `transform` and `opacity`), domain→React imports, cross-feature imports, `git add -A`, commits on `main`, Claude co-author trailers. Fix the code, never bypass.
- `src/shared/ui` must not import from `src/features/*`.
- Source Serif (`displaySm`, `display`, `displayLg`, `hero`) never on controls, inputs, scan results or text < 24 px.
- Violet is never a status colour or a large fill; status uses `StatusPill` tones `neutral · info · success · warning · danger`.
- Gate: controls 64 high (`density.gate.controlHeight`), targets ≥ 48 visual with hitSlop to ≥ 56, ≥ 16 apart (`density.gate.targetGap`). Elsewhere targets ≥ 44.
- Gate outcomes: no animation, `maxScale 1`, colour + icon + word + cue. Four fills: Admitted `#166534`, Already used `#FBBF24` (ink text), Refused `#991B1B`, Couldn't check `#4A4670`. Amber means Already used only.
- Transient failures (network, 429, 5xx, timeout, "isn't available") are never styled red.
- No new native dependency. Install anything with `npx expo install` (none expected).
- RNTL v14 is async: `await render(...)`, `await fireEvent.press(...)`, `await act(...)`. zod v4.
- Every task ends green: `npx tsc --noEmit`, `npx expo lint`, `npx jest <touched tests>`; the final task runs the full suite.
- Commits: stage specific paths only, conventional message, no trailer, on branch `feat/ui-a-foundation-gate`.
- Copy: sentence case, verb-first, no exclamation marks, no blame.

## Review Focus

1. **Large text (200 %) on the scanner and sheets** — labels must not clip the three bottom controls or push the outcome actions off screen. Pinned by: Task 10 test asserting control labels use `maxScale` ≤ 1.3 and outcome text `maxScale` 1.
2. **Reduce Motion turned on while a screen is open** — every animated part must stop animating without a remount. Pinned by: Task 2 test that `useMotionTier` updates on the `reduceMotionChanged` event, and Task 6 test that `Skeleton` renders static under `none`.
3. **A status that changes every 30 s must not re-announce** — the live region keys on the pill's *kind*, not its text. Pinned by: Task 9 test that `announceKey` is unchanged between "list 2 min ago" and "list 3 min ago".
4. **Override busy and lookup busy must stay visibly busy and non-repeatable** after the restyle. Pinned by: Task 8 (override button disabled + spinner while busy) and Task 12 (Admit disabled while admitting).
5. **An event with no start date or an unparsable date** in the event list must still render (date tile shows "TBC", no pill). Pinned by: Task 13 `eventStatus`/`dateTile` tests.

---

## File map

**Theme** (`src/shared/theme`): `tokens.ts` (+ neutral status, inverse), `theme.ts` (roles, `textTone`, `surfaceTone`), `type.ts` (+ `displayLg`, `hero`, `outcome`, `numLg`), new `elevation.ts`, `motion.ts`, `sizes.ts`, `index.ts` (exports; drop `palette`), tests `contrast.test.ts`, new `brand.test.ts`.

**Kit** (`src/shared/ui`): new `DensityProvider.tsx`, `motion.ts` (hook `useMotionTier`), `PressableScale.tsx`, `IconButton.tsx`, `ToggleButton.tsx`, `TextLink.tsx`, `SearchField.tsx`, `PinField.tsx`, `Header.tsx`, `Sheet.tsx`, `ListRow.tsx`, `SegmentedControl.tsx`, `Divider.tsx`, `StatusPill.tsx`, `Banner.tsx`, `EmptyState.tsx`, `ErrorState.tsx`, `Skeleton.tsx`, `Spinner.tsx`, `Illustration.tsx`, `SuccessMark.tsx`, `OutcomeScreen.tsx`; modified `Button.tsx`, `Icon.tsx`, `Input.tsx`, `Text.tsx`, `Box.tsx`, `Screen.tsx`, `ScreenError.tsx`, `index.ts`.

**Routes:** `src/app/(gate)/_layout.tsx`, `(receptionist)/_layout.tsx`, `(customer)/_layout.tsx`, `(auth)/_layout.tsx` (density providers); `src/app/(gate)/gate/[eventId].tsx` (no auto permission request), `src/app/(gate)/gate/index.tsx` (account sheet).

**Gate:** domain `present.ts` (fixable → refused), new `statusPill.ts`, `syncLine.ts` (drop `syncLine`/`SyncLine`), `eventList.ts` (+ `eventStatus`, `dateTile`); offline `rosterStore.ts` (+ `readyEventIds`); hooks new `useOfflineLists.ts`; ui `OutcomeOverlay.tsx`, new `GateStatus.tsx`, delete `SyncBar.tsx`, new `CameraPrompt.tsx`, `EnterCodeSheet.tsx`, `RecentSheet.tsx`, `PinSheet.tsx`, `FindGuestSheet.tsx`, `ActivityScreen.tsx`, new `AccountSheet.tsx`; screens `ScannerScreen.tsx`, `EventListScreen.tsx`. Mode: `ModeSwitcher.tsx` (radio group). Auth: `SignInScreen.tsx` (neutral transient errors).

**Docs:** `docs/DESIGN_SYSTEM.md` §8 kit list, `docs/device-tests/2026-10-08-gate-phone-checklist.md` Redesign section.

---

### Task 1: Theme tokens, roles and brand pin

**Files:**
- Modify: `src/shared/theme/tokens.ts`, `src/shared/theme/theme.ts`, `src/shared/theme/type.ts`, `src/shared/theme/index.ts`
- Create: `src/shared/theme/elevation.ts`, `src/shared/theme/motion.ts`, `src/shared/theme/sizes.ts`
- Modify: `src/shared/ui/Text.tsx`, `src/shared/ui/Box.tsx` (accept the new roles)
- Test: `src/shared/theme/__tests__/contrast.test.ts`, create `src/shared/theme/__tests__/brand.test.ts`, `src/shared/ui/__tests__/Text.test.tsx`

**Interfaces:**
- Produces:
  - `color.inverse`, `color.onInverse`, `color.status.neutral: {bg, fg, solid}`.
  - `type ColorRole = keyof typeof textTone` where `textTone` keys are `textPrimary | textSecondary | textMuted | onAction | linkText | onInverse | successFg | warningFg | dangerFg | infoFg | neutralFg | dangerSolid`.
  - `type SurfaceRole = keyof typeof surfaceTone` with keys `surface | canvas | wash | actionFill | selectedWash | inverse | successBg | warningBg | dangerBg | infoBg | neutralBg`.
  - `export type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'`.
  - Type variants `displayLg`, `hero`, `outcome`, `numLg`.
  - `elevation` (levels `e2 | e3 | e4` → RN style objects), `motion` (`duration`, `easing`, `spring`), `iconSize` (`xs 16 | sm 20 | md 24 | lg 32 | xl 96 | xxl 128`), `borderWidth` (`hairline 1 | thick 2`), `layout` (`tabletBreakpoint 768`, `tabletGutter 24`, `phoneGutter 16`, `formMaxWidth 640`).

- [ ] **Step 1: Write the failing tests**

`src/shared/theme/__tests__/brand.test.ts`:

```ts
import { color } from '@/shared/theme/theme';

// Must equal the web (../web/tailwind.config.js brand-*, app/globals.css --primary/--foreground).
describe('brand parity with the web', () => {
  it('violet, pressed violet, washes and ink match the web values', () => {
    expect(color.actionFill).toBe('#7C3AED');
    expect(color.actionPressed).toBe('#6D28D9');
    expect(color.linkText).toBe('#6D28D9');
    expect(color.selectedWash).toBe('#EBE5FF');
    expect(color.textPrimary).toBe('#1A0D4D');
  });
});
```

Append to `contrast.test.ts` `textPairs` (keep existing rows):

```ts
    [color.status.success.fg, color.surface],
    [color.status.warning.fg, color.surface],
    [color.status.danger.fg, color.surface],
    [color.status.info.fg, color.surface],
    [color.status.neutral.fg, color.status.neutral.bg],
    [color.status.danger.solid, color.surface],
    [color.linkText, color.selectedWash],
    [color.linkText, color.canvas],
    [color.onInverse, color.inverse],
```

Append to `src/shared/ui/__tests__/Text.test.tsx`:

```tsx
it('renders a status tone colour', async () => {
  await render(<Text tone="dangerFg">Wrong PIN</Text>);
  expect(screen.getByText('Wrong PIN')).toHaveStyle({ color: color.status.danger.fg });
});

it('the outcome variant is sans, never serif', () => {
  expect(typeVariants.outcome.font).toBe('sans');
  expect(typeVariants.outcome.maxScale).toBe(1);
});
```

(Import `color`, `typeVariants` from `@/shared/theme` at the top of the file if not already imported.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/shared/theme src/shared/ui/__tests__/Text.test.tsx`
Expected: FAIL (`color.status.neutral` undefined, `dangerFg` not a role, `typeVariants.outcome` undefined).

- [ ] **Step 3: Implement tokens**

`tokens.ts` — add to `palette` (keep all existing keys):

```ts
  // Neutral status ("couldn't reach", lookup/override markers): ink-soft text on wash.
  neutral: '#4A4670',
```

`theme.ts` — full replacement:

```ts
import { palette } from './tokens';

export const color = {
  surface: palette.white,
  canvas: palette.canvas,
  wash: palette.wash,
  border: palette.line,
  borderStrong: palette.lineStrong,
  textPrimary: palette.ink,
  textSecondary: palette.inkSoft,
  textMuted: palette.inkMuted,
  actionFill: palette.violet600,
  actionPressed: palette.violet700,
  onAction: palette.white,
  linkText: palette.violet700,
  selectedWash: palette.violet100,
  // The scanner's dark surface (camera letterbox, top/bottom bars over the camera).
  inverse: palette.ink,
  onInverse: palette.white,
  status: {
    neutral: { bg: palette.wash, fg: palette.neutral, solid: palette.neutral },
    success: { bg: palette.successWash, fg: palette.successInk, solid: palette.success },
    warning: { bg: palette.warningWash, fg: palette.warningInk, solid: palette.warning },
    danger: { bg: palette.dangerWash, fg: palette.dangerInk, solid: palette.danger },
    info: { bg: palette.infoWash, fg: palette.infoInk, solid: palette.info },
  },
  outcome: {
    admitted: { bg: palette.gateAdmitted, fg: palette.white },
    used: { bg: palette.gateUsedBg, fg: palette.ink },
    refused: { bg: palette.gateRefused, fg: palette.white },
    retry: { bg: palette.gateRetry, fg: palette.white },
  },
} as const;

export type StatusTone = keyof typeof color.status;

export const textTone = {
  textPrimary: color.textPrimary,
  textSecondary: color.textSecondary,
  textMuted: color.textMuted,
  onAction: color.onAction,
  linkText: color.linkText,
  onInverse: color.onInverse,
  successFg: color.status.success.fg,
  warningFg: color.status.warning.fg,
  dangerFg: color.status.danger.fg,
  infoFg: color.status.info.fg,
  neutralFg: color.status.neutral.fg,
  dangerSolid: color.status.danger.solid,
} as const;
export type ColorRole = keyof typeof textTone;

export const surfaceTone = {
  surface: color.surface,
  canvas: color.canvas,
  wash: color.wash,
  actionFill: color.actionFill,
  selectedWash: color.selectedWash,
  inverse: color.inverse,
  successBg: color.status.success.bg,
  warningBg: color.status.warning.bg,
  dangerBg: color.status.danger.bg,
  infoBg: color.status.info.bg,
  neutralBg: color.status.neutral.bg,
} as const;
export type SurfaceRole = keyof typeof surfaceTone;
```

`type.ts` — add these entries to `typeVariants` (after `display`, keep the rest):

```ts
  displayLg: {
    font: 'serif',
    weight: 500,
    size: 48,
    lineHeight: 56,
    letterSpacing: -1.44,
    maxScale: 1.15,
  },
  // Onboarding only.
  hero: { font: 'serif', weight: 500, size: 64, lineHeight: 68, letterSpacing: -2.24, maxScale: 1 },
  // Gate result titles: sans, fixed size (DESIGN_SYSTEM §3: serif never on scan results).
  outcome: { font: 'sans', weight: 600, size: 36, lineHeight: 44, letterSpacing: -0.5, maxScale: 1 },
  // Door counter.
  numLg: { font: 'sans', weight: 600, size: 48, lineHeight: 52, letterSpacing: -1, maxScale: 1 },
```

`elevation.ts`:

```ts
import { Platform, type ViewStyle } from 'react-native';

import { palette } from './tokens';

// DESIGN_SYSTEM §5: borders first; shadows only for floating layers. Ink-tinted, never black.
const level = (y: number, blur: number, opacity: number, android: number): ViewStyle =>
  Platform.OS === 'android'
    ? { elevation: android }
    : { shadowColor: palette.ink, shadowOffset: { width: 0, height: y }, shadowRadius: blur / 2, shadowOpacity: opacity };

export const elevation = {
  e2: level(2, 15, 0.07, 2),
  e3: level(4, 25, 0.1, 6),
  e4: level(10, 40, 0.15, 12),
} as const;
export type ElevationKey = keyof typeof elevation;
```

`motion.ts` (tokens only; the hook lives in the kit, Task 2):

```ts
// MOTION.md §4. Durations in ms; easings as cubic-bezier control points.
export const motion = {
  duration: { instant: 0, fast: 100, base: 180, moderate: 300, slow: 500 },
  easing: {
    standard: [0.2, 0, 0, 1],
    decelerate: [0.05, 0.7, 0.1, 1],
    accelerate: [0.3, 0, 0.8, 0.15],
    linear: [0, 0, 1, 1],
  },
  spring: {
    press: { damping: 20, stiffness: 400, mass: 0.6, overshootClamping: true },
    sheet: { damping: 28, stiffness: 260, mass: 1, overshootClamping: true },
    playful: { damping: 14, stiffness: 180, mass: 1, overshootClamping: false },
  },
} as const;
export type MotionTier = 'full' | 'reduced' | 'none';
```

`sizes.ts`:

```ts
export const iconSize = { xs: 16, sm: 20, md: 24, lg: 32, xl: 96, xxl: 128 } as const;
export type IconSizeKey = keyof typeof iconSize;

export const borderWidth = { hairline: 1, thick: 2 } as const;

export const layout = {
  phoneGutter: 16,
  tabletGutter: 24,
  tabletBreakpoint: 768,
  formMaxWidth: 640,
} as const;
```

`index.ts` — full replacement (drops `palette`):

```ts
export { space, radius } from './tokens';
export type { SpaceKey, RadiusKey } from './tokens';
export { color, textTone, surfaceTone } from './theme';
export type { ColorRole, SurfaceRole, StatusTone } from './theme';
export { typeVariants } from './type';
export type { Variant, FontKind } from './type';
export { density } from './density';
export type { DensityName } from './density';
export { contrastRatio } from './contrast';
export { elevation } from './elevation';
export type { ElevationKey } from './elevation';
export { motion } from './motion';
export type { MotionTier } from './motion';
export { iconSize, borderWidth, layout } from './sizes';
export type { IconSizeKey } from './sizes';
```

Then run `grep -rn "palette" src --include=*.ts --include=*.tsx | grep -v src/shared/theme` and replace any import of `palette` outside `src/shared/theme` with the matching `color.*` role (expected: none; the audit found none).

`Text.tsx`: change `color: color[tone]` to `color: textTone[tone]` and import `textTone` instead of `color`.
`Box.tsx`: change `backgroundColor: bg ? color[bg] : undefined` to `bg ? surfaceTone[bg] : undefined`; import `surfaceTone` (keep `color` for `color.border`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/shared/theme src/shared/ui && npx tsc --noEmit`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/shared/theme src/shared/ui/Text.tsx src/shared/ui/Box.tsx src/shared/ui/__tests__/Text.test.tsx
git commit -m "feat(theme): status and inverse roles, outcome and display type, elevation, motion and size tokens, brand pin"
```

---

### Task 2: Density context, motion tier and press feedback

**Files:**
- Create: `src/shared/ui/DensityProvider.tsx`, `src/shared/ui/motion.ts`, `src/shared/ui/PressableScale.tsx`
- Modify: `src/app/(gate)/_layout.tsx`, `src/app/(receptionist)/_layout.tsx`, `src/app/(customer)/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `jest.setup.ts` (only if Step 2 shows Reanimated needs it)
- Test: `src/shared/ui/__tests__/density.test.tsx`, `src/shared/ui/__tests__/motion.test.tsx`

**Interfaces:**
- Consumes: `density`, `DensityName`, `motion`, `MotionTier` from `@/shared/theme`.
- Produces:
  - `DensityProvider({ density: DensityName, children })`, `useDensity(): (typeof density)[DensityName]` (default `customer` with no provider), `useDensityName(): DensityName`.
  - `useMotionTier(): MotionTier` — `none` when Reduce Motion is on (updates live on `reduceMotionChanged`); otherwise by density: `customer → full`, `work → reduced`, `gate → reduced`.
  - `PressableScale(props: PressableProps & { style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>) })` — Pressable whose content scales to 0.97 on press with `motion.spring.press` when tier is not `none`.

**Ruling recorded here (spec §3.2 vs decision 9):** the gate's default tier is `reduced`: press spring and native sheet slide stay; the skeleton is static (it pulses only on `full`). Under Reduce Motion everything is `none`.

- [ ] **Step 1: Verify Reanimated under Jest and in SDK 57**

Ask the `expo-docs-researcher` subagent (or read the Reanimated 4.5 docs "Testing with Jest" page and `https://docs.expo.dev/versions/v57.0.0/sdk/reanimated/`) for: the Jest setup Reanimated 4 needs with `jest-expo`, and the current names of `useSharedValue`, `useAnimatedStyle`, `withSpring`, `withRepeat`, `withTiming`, `Animated.View`. Record the answer in the task report. If a setup call is needed, add it to `jest.setup.ts` exactly as documented (e.g. `require('react-native-reanimated').setUpTests();`).

- [ ] **Step 2: Write the failing tests**

`src/shared/ui/__tests__/density.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { density } from '@/shared/theme';
import { DensityProvider, useDensity } from '@/shared/ui/DensityProvider';

function Probe() {
  const d = useDensity();
  return <Text>{String(d.controlHeight)}</Text>;
}

it('defaults to customer density without a provider', async () => {
  await render(<Probe />);
  expect(screen.getByText(String(density.customer.controlHeight))).toBeTruthy();
});

it('gate provider gives 64 pt controls', async () => {
  await render(
    <DensityProvider density="gate">
      <Probe />
    </DensityProvider>,
  );
  expect(screen.getByText('64')).toBeTruthy();
});
```

`src/shared/ui/__tests__/motion.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Text } from 'react-native';

import { DensityProvider } from '@/shared/ui/DensityProvider';
import { useMotionTier } from '@/shared/ui/motion';

let emit: ((on: boolean) => void) | null = null;
beforeEach(() => {
  emit = null;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'addEventListener').mockImplementation((_e, cb) => {
    emit = cb as (on: boolean) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AccessibilityInfo.addEventListener>;
  });
});

function Probe() {
  return <Text>{useMotionTier()}</Text>;
}

it.each([
  ['customer', 'full'],
  ['work', 'reduced'],
  ['gate', 'reduced'],
] as const)('%s density defaults to %s', async (d, tier) => {
  await render(
    <DensityProvider density={d}>
      <Probe />
    </DensityProvider>,
  );
  expect(screen.getByText(tier)).toBeTruthy();
});

it('Reduce Motion switches to none live, and back', async () => {
  await render(<Probe />);
  expect(screen.getByText('full')).toBeTruthy();
  await act(() => {
    emit?.(true);
  });
  expect(screen.getByText('none')).toBeTruthy();
  await act(() => {
    emit?.(false);
  });
  expect(screen.getByText('full')).toBeTruthy();
});

it('reads the initial Reduce Motion setting', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render(<Probe />);
  expect(await screen.findByText('none')).toBeTruthy();
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest src/shared/ui/__tests__/density.test.tsx src/shared/ui/__tests__/motion.test.tsx`
Expected: FAIL (modules not found).

- [ ] **Step 4: Implement**

`src/shared/ui/DensityProvider.tsx`:

```tsx
import { createContext, useContext, type ReactNode } from 'react';

import { density, type DensityName } from '@/shared/theme';

const DensityContext = createContext<DensityName>('customer');

// Set once per mode's route group: gate → gate, receptionist → work, customer/auth → customer.
export function DensityProvider({ density: name, children }: { density: DensityName; children: ReactNode }) {
  return <DensityContext.Provider value={name}>{children}</DensityContext.Provider>;
}

export function useDensityName(): DensityName {
  return useContext(DensityContext);
}

export function useDensity() {
  return density[useContext(DensityContext)];
}
```

`src/shared/ui/motion.ts`:

```ts
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { DensityName, MotionTier } from '@/shared/theme';

import { useDensityName } from './DensityProvider';

const BY_DENSITY: Record<DensityName, MotionTier> = {
  customer: 'full',
  work: 'reduced',
  gate: 'reduced',
};

// MOTION.md §6: every animation reads this. Reduce Motion wins and is followed live.
export function useMotionTier(): MotionTier {
  const name = useDensityName();
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce ? 'none' : BY_DENSITY[name];
}
```

`src/shared/ui/PressableScale.tsx` (use the API names confirmed in Step 1):

```tsx
import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '@/shared/theme';

import { useMotionTier } from './motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: ReactNode;
};

// Inventory #3: scale 0.97 on press (transform only), skipped under `none`.
export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: Props) {
  const tier = useMotionTier();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={(e) => {
        if (tier !== 'none') scale.value = withSpring(0.97, motion.spring.press);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (tier !== 'none') scale.value = withSpring(1, motion.spring.press);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={animated}>{children}</Animated.View>
    </Pressable>
  );
}
```

Note: the animated wrapper sits inside the Pressable, so the Pressable's own `style` (size, background) is not scaled; only the content is. That is intended for gate targets (the hit area never shrinks).

Route layouts — wrap the existing `<Stack …/>` in each group layout:

```tsx
// src/app/(gate)/_layout.tsx
import { Stack } from 'expo-router';

import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

export default function ModeLayout() {
  return (
    <DensityProvider density="gate">
      <Stack screenOptions={{ headerShown: false }} />
    </DensityProvider>
  );
}
```

Do the same in `(receptionist)/_layout.tsx` with `density="work"`, and `(customer)/_layout.tsx` and `(auth)/_layout.tsx` with `density="customer"` (read each file first and keep its existing exports and options).

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest src/shared/ui && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/shared/ui/DensityProvider.tsx src/shared/ui/motion.ts src/shared/ui/PressableScale.tsx src/shared/ui/__tests__/density.test.tsx src/shared/ui/__tests__/motion.test.tsx "src/app/(gate)/_layout.tsx" "src/app/(receptionist)/_layout.tsx" "src/app/(customer)/_layout.tsx" "src/app/(auth)/_layout.tsx"
git commit -m "feat(ui): density context per mode, motion tier hook and press feedback"
```

(Add `jest.setup.ts` to the `git add` only if Step 1 changed it.)

---

### Task 3: Actions — Button, IconButton, ToggleButton, TextLink, Icon

**Files:**
- Modify: `src/shared/ui/Button.tsx`, `src/shared/ui/Icon.tsx`, `src/shared/ui/index.ts`
- Create: `src/shared/ui/IconButton.tsx`, `src/shared/ui/ToggleButton.tsx`, `src/shared/ui/TextLink.tsx`, `src/shared/ui/Spinner.tsx`
- Test: `src/shared/ui/__tests__/Button.test.tsx` (extend), create `src/shared/ui/__tests__/IconButton.test.tsx`

**Interfaces:**
- Consumes: `useDensity` (Task 2), `PressableScale` (Task 2), `textTone`, `iconSize`, `ColorRole` (Task 1).
- Produces:
  - `Button({ label, accessibilityLabel?, onPress, variant?: 'primary'|'secondary'|'ghost'|'destructive', onInverse?: 'light'|'dark', disabled?, loading?, testID?, icon?: LucideIcon })`. `loading` keeps the label visible next to a spinner. Height = `useDensity().controlHeight`.
  - `Icon({ as, size?: IconSizeKey | 16|20|24|32, tone?: ColorRole, color?: string })` — `tone` preferred; `color` kept for kit-internal use (OutcomeScreen, Illustration).
  - `Spinner({ tone?: ColorRole, label?: string })`.
  - `IconButton({ icon, accessibilityLabel, onPress, label?, variant?: 'plain'|'filled'|'inverse', size?: 'md'|'lg', testID?, disabled? })` — round; `lg` = density control height, `md` = density minTarget; `hitSlop` brings the effective target to ≥ 56 on gate.
  - `ToggleButton({ icon, iconOn?, label, accessibilityLabel?, checked, onChange: (next: boolean) => void, variant?: 'plain'|'inverse', size?: 'md'|'lg', testID? })` — `accessibilityRole="switch"`, `accessibilityState={{ checked }}`.
  - `TextLink({ label, onPress, accessibilityLabel?, testID? })` — `linkText`, `label` variant, `minHeight` 44 via padding.

- [ ] **Step 1: Write the failing tests**

Append to `src/shared/ui/__tests__/Button.test.tsx` (keep existing tests; they still pass because `variant`, `loading`, `disabled`, `label` keep their meaning):

```tsx
import { DensityProvider } from '@/shared/ui/DensityProvider';

it('is 64 tall under gate density', async () => {
  await render(
    <DensityProvider density="gate">
      <Button label="Confirm" onPress={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByRole('button', { name: 'Confirm' })).toHaveStyle({ minHeight: 64 });
});

it('keeps the label visible while busy and blocks presses', async () => {
  const onPress = jest.fn();
  await render(<Button label="Confirm" loading onPress={onPress} />);
  const b = screen.getByRole('button', { name: 'Confirm' });
  expect(screen.getByText('Confirm')).toBeTruthy();
  expect(b).toHaveAccessibilityState({ busy: true, disabled: true });
  await fireEvent.press(b);
  expect(onPress).not.toHaveBeenCalled();
});

it('destructive uses the danger fill', async () => {
  await render(<Button label="Sign out" variant="destructive" onPress={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Sign out' })).toHaveStyle({
    backgroundColor: color.status.danger.solid,
  });
});
```

`src/shared/ui/__tests__/IconButton.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Flashlight, Search } from 'lucide-react-native';

import { DensityProvider } from '@/shared/ui/DensityProvider';
import { IconButton } from '@/shared/ui/IconButton';
import { TextLink } from '@/shared/ui/TextLink';
import { ToggleButton } from '@/shared/ui/ToggleButton';

it('icon button is a labelled button with a visible label under it', async () => {
  const onPress = jest.fn();
  await render(<IconButton icon={Search} accessibilityLabel="Find guest" label="Find guest" onPress={onPress} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Find guest' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Find guest')).toBeTruthy();
});

it('large icon button is 64 round under gate density', async () => {
  await render(
    <DensityProvider density="gate">
      <IconButton icon={Search} accessibilityLabel="Find guest" size="lg" onPress={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByTestId('icon-button-face')).toHaveStyle({ width: 64, height: 64, borderRadius: 32 });
});

it('toggle is a switch that reports checked and flips', async () => {
  const onChange = jest.fn();
  await render(<ToggleButton icon={Flashlight} label="Torch" checked={false} onChange={onChange} />);
  const sw = screen.getByRole('switch', { name: 'Torch' });
  expect(sw).toHaveAccessibilityState({ checked: false });
  await fireEvent.press(sw);
  expect(onChange).toHaveBeenCalledWith(true);
});

it('text link has a 44 pt target', async () => {
  await render(<TextLink label="Change event" onPress={jest.fn()} />);
  expect(screen.getByRole('link', { name: 'Change event' })).toHaveStyle({ minHeight: 44 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/shared/ui/__tests__/Button.test.tsx src/shared/ui/__tests__/IconButton.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`Icon.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react-native';

import { iconSize, textTone, type ColorRole, type IconSizeKey } from '@/shared/theme';

type Props = {
  as: LucideIcon;
  size?: IconSizeKey | 16 | 20 | 24 | 32;
  tone?: ColorRole;
  /** Kit-internal escape hatch for fills chosen by role elsewhere (outcome fg). */
  color?: string;
  strokeWidth?: number;
};

export function Icon({ as: Glyph, size = 'md', tone = 'textPrimary', color, strokeWidth = 1.75 }: Props) {
  const px = typeof size === 'number' ? size : iconSize[size];
  return <Glyph size={px} color={color ?? textTone[tone]} strokeWidth={strokeWidth} />;
}
```

Existing callers pass `color={color.x}` and numeric sizes; both still type-check.

`Spinner.tsx`:

```tsx
import { ActivityIndicator } from 'react-native';

import { textTone, type ColorRole } from '@/shared/theme';

export function Spinner({ tone = 'textPrimary', label }: { tone?: ColorRole; label?: string }) {
  return <ActivityIndicator color={textTone[tone]} accessibilityLabel={label} />;
}
```

`Button.tsx` — full replacement:

```tsx
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { borderWidth, color, radius, space, type ColorRole } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Spinner } from './Spinner';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

type Props = {
  label: string;
  /** Screen-reader label when several buttons share a visible label (defaults to label). */
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: ButtonVariant;
  /**
   * On a coloured full-screen fill or the dark scanner: `light` = white fill / white outline,
   * `dark` = ink fill / ink outline (for the amber "Already used" fill).
   */
  onInverse?: 'light' | 'dark';
  disabled?: boolean;
  loading?: boolean;
  icon?: LucideIcon;
  testID?: string;
};

type Look = { bg: string; pressed: string; border: string | null; fg: ColorRole };

function look(variant: ButtonVariant, onInverse: 'light' | 'dark' | undefined): Look {
  if (onInverse === 'light')
    return variant === 'primary'
      ? { bg: color.onInverse, pressed: color.wash, border: null, fg: 'textPrimary' }
      : { bg: 'transparent', pressed: 'transparent', border: color.onInverse, fg: 'onInverse' };
  if (onInverse === 'dark')
    return variant === 'primary'
      ? { bg: color.textPrimary, pressed: color.textSecondary, border: null, fg: 'onInverse' }
      : { bg: 'transparent', pressed: 'transparent', border: color.textPrimary, fg: 'textPrimary' };
  switch (variant) {
    case 'primary':
      return { bg: color.actionFill, pressed: color.actionPressed, border: null, fg: 'onAction' };
    case 'secondary':
      return { bg: color.surface, pressed: color.wash, border: color.borderStrong, fg: 'textPrimary' };
    case 'ghost':
      return { bg: 'transparent', pressed: color.wash, border: null, fg: 'linkText' };
    case 'destructive':
      return { bg: color.status.danger.solid, pressed: color.status.danger.fg, border: null, fg: 'onAction' };
  }
}

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  onInverse,
  disabled,
  loading,
  icon,
  testID,
}: Props) {
  const d = useDensity();
  const inactive = disabled === true || loading === true;
  const l = look(variant, onInverse);
  // Disabled is a muted fill, not 50 % opacity (unreadable in sunlight).
  const muted = disabled === true && loading !== true;
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading === true }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: d.controlHeight,
        paddingHorizontal: space.s5,
        borderRadius: radius.r3,
        borderCurve: 'continuous',
        justifyContent: 'center',
        backgroundColor: muted ? color.wash : pressed ? l.pressed : l.bg,
        borderWidth: l.border === null ? 0 : borderWidth.thick,
        borderColor: muted ? color.border : (l.border ?? undefined),
      })}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.s3 }}>
        {loading === true ? <Spinner tone={l.fg} /> : icon !== undefined ? <Icon as={icon} size="sm" tone={muted ? 'textMuted' : l.fg} /> : null}
        <Text variant="bodyStrong" tone={muted ? 'textMuted' : l.fg} numberOfLines={2} align="center">
          {label}
        </Text>
      </View>
    </PressableScale>
  );
}
```

`IconButton.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { color, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  icon: LucideIcon;
  accessibilityLabel: string;
  onPress: () => void;
  /** Visible label under the circle (scanner bottom controls). */
  label?: string;
  variant?: 'plain' | 'filled' | 'inverse';
  size?: 'md' | 'lg';
  disabled?: boolean;
  testID?: string;
};

const FACE = { plain: color.surface, filled: color.actionFill, inverse: color.inverse } as const;
const FG = { plain: 'textPrimary', filled: 'onAction', inverse: 'onInverse' } as const;

export function IconButton({ icon, accessibilityLabel, onPress, label, variant = 'plain', size = 'md', disabled, testID }: Props) {
  const d = useDensity();
  const px = size === 'lg' ? d.controlHeight : d.minTarget;
  const slop = Math.max(0, Math.ceil((56 - px) / 2));
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={slop}
      style={{ alignItems: 'center', gap: space.s2 }}
    >
      <View
        testID="icon-button-face"
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: FACE[variant],
          borderWidth: variant === 'plain' ? 1 : 0,
          borderColor: color.border,
        }}
      >
        <Icon as={icon} size={size === 'lg' ? 'lg' : 'md'} tone={FG[variant]} />
      </View>
      {label !== undefined ? (
        <Text variant="label" tone={variant === 'inverse' ? 'onInverse' : 'textPrimary'} maxScale={1.3} numberOfLines={1}>
          {label}
        </Text>
      ) : null}
    </PressableScale>
  );
}
```

`ToggleButton.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { color, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

type Props = {
  icon: LucideIcon;
  /** Icon while checked (e.g. Volume2 vs VolumeX); defaults to `icon`. */
  iconOn?: LucideIcon;
  label: string;
  accessibilityLabel?: string;
  /** Hide the visible label (top-bar toggles); the switch keeps its name. */
  hideLabel?: boolean;
  checked: boolean;
  onChange: (next: boolean) => void;
  variant?: 'plain' | 'inverse';
  size?: 'md' | 'lg';
  testID?: string;
};

export function ToggleButton({ icon, iconOn, label, accessibilityLabel, hideLabel, checked, onChange, variant = 'plain', size = 'md', testID }: Props) {
  const d = useDensity();
  const px = size === 'lg' ? d.controlHeight : d.minTarget;
  const inverse = variant === 'inverse';
  // Checked is shown by fill + icon, never by violet alone.
  const face = checked ? (inverse ? color.onInverse : color.textPrimary) : inverse ? color.inverse : color.surface;
  const fg = checked ? (inverse ? 'textPrimary' : 'onInverse') : inverse ? 'onInverse' : 'textPrimary';
  return (
    <PressableScale
      testID={testID}
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ checked }}
      onPress={() => {
        onChange(!checked);
      }}
      hitSlop={Math.max(0, Math.ceil((56 - px) / 2))}
      style={{ alignItems: 'center', gap: space.s2 }}
    >
      <View
        style={{
          width: px,
          height: px,
          borderRadius: px / 2,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: face,
          borderWidth: 1,
          borderColor: inverse ? color.onInverse : color.border,
        }}
      >
        <Icon as={checked && iconOn !== undefined ? iconOn : icon} size={size === 'lg' ? 'lg' : 'md'} tone={fg} />
      </View>
      {hideLabel === true ? null : (
        <Text variant="label" tone={inverse ? 'onInverse' : 'textPrimary'} maxScale={1.3} numberOfLines={1}>
          {label}
        </Text>
      )}
    </PressableScale>
  );
}
```

`TextLink.tsx`:

```tsx
import { Pressable } from 'react-native';

import { space } from '@/shared/theme';

import { Text } from './Text';

type Props = { label: string; onPress: () => void; accessibilityLabel?: string; testID?: string };

export function TextLink({ label, onPress, accessibilityLabel, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: space.s2 }}
    >
      <Text variant="label" tone="linkText">
        {label}
      </Text>
    </Pressable>
  );
}
```

`index.ts` — add exports: `IconButton`, `ToggleButton`, `TextLink`, `Spinner`, `DensityProvider`, `useDensity`, `useMotionTier` (from `./motion`), `PressableScale`, and `type ButtonVariant`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/shared/ui src/features && npx tsc --noEmit && npx expo lint`
Expected: PASS. Existing feature tests that query buttons by name still pass (labels unchanged). If any existing test asserted `opacity: 0.5` for disabled, update it to assert `accessibilityState.disabled` and note it in the report.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui
git commit -m "feat(ui): button variants and density sizing, icon and toggle buttons, text link, spinner"
```

---

### Task 4: Inputs — Input, SearchField, PinField

**Files:**
- Modify: `src/shared/ui/Input.tsx`, `src/shared/ui/index.ts`
- Create: `src/shared/ui/SearchField.tsx`, `src/shared/ui/PinField.tsx`
- Test: create `src/shared/ui/__tests__/Input.test.tsx`

**Interfaces:**
- Consumes: `useDensity`, `Icon`, `textTone`.
- Produces:
  - `Input(TextInputProps & { label: string; error?: string; hint?: string; right?: ReactNode; left?: ReactNode })`. The `TextInput` keeps `accessibilityLabel={label}`; `accessibilityHint` = error ?? hint.
  - `SearchField({ label, value, onChangeText, placeholder?, autoFocus?, testID? })` — Input with a search icon left and a clear `IconButton` right when non-empty; `returnKeyType="search"`.
  - `PinField({ label, value, onChangeText, length?: number (6), error?: string, testID? })` — one hidden `TextInput` (`accessibilityLabel={label}`, `keyboardType="number-pad"`, `secureTextEntry`, `maxLength={length}`, `autoComplete="off"`, `textContentType="none"`) under six visible boxes showing `•` per digit; tapping the boxes focuses the input.

- [ ] **Step 1: Write the failing tests**

`src/shared/ui/__tests__/Input.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { DensityProvider } from '@/shared/ui/DensityProvider';
import { Input } from '@/shared/ui/Input';
import { PinField } from '@/shared/ui/PinField';
import { SearchField } from '@/shared/ui/SearchField';

it('links the error to the field for screen readers', async () => {
  await render(<Input label="Approver" value="" onChangeText={jest.fn()} error="Enter a name" />);
  expect(screen.getByLabelText('Approver').props.accessibilityHint).toBe('Enter a name');
  expect(screen.getByText('Enter a name')).toBeTruthy();
});

it('shows a hint when there is no error', async () => {
  await render(<Input label="Reason" value="" onChangeText={jest.fn()} hint="3 to 200 characters" />);
  expect(screen.getByText('3 to 200 characters')).toBeTruthy();
});

it('is 64 tall under gate density', async () => {
  await render(
    <DensityProvider density="gate">
      <Input label="Approver" value="" onChangeText={jest.fn()} />
    </DensityProvider>,
  );
  expect(screen.getByLabelText('Approver')).toHaveStyle({ minHeight: 64 });
});

it('search field clears with one tap', async () => {
  const onChangeText = jest.fn();
  await render(<SearchField label="Search guests" value="ade" onChangeText={onChangeText} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
  expect(onChangeText).toHaveBeenCalledWith('');
});

it('pin field keeps one secure numeric input and masks digits', async () => {
  const onChangeText = jest.fn();
  await render(<PinField label="PIN" value="12" onChangeText={onChangeText} />);
  const input = screen.getByLabelText('PIN');
  expect(input.props.secureTextEntry).toBe(true);
  expect(input.props.keyboardType).toBe('number-pad');
  expect(input.props.maxLength).toBe(6);
  expect(screen.getAllByText('•')).toHaveLength(2);
  await fireEvent.changeText(input, '123');
  expect(onChangeText).toHaveBeenCalledWith('123');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/shared/ui/__tests__/Input.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`Input.tsx` — full replacement:

```tsx
import { useState, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { borderWidth, color, radius, space, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

import { useDensity } from './DensityProvider';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  error?: string | undefined;
  hint?: string;
  left?: ReactNode;
  right?: ReactNode;
};

export function Input({ label, error, hint, left, right, onFocus, onBlur, style, ...rest }: Props) {
  const v = typeVariants.body;
  const d = useDensity();
  const [focused, setFocused] = useState(false);
  const border = error ? color.status.danger.solid : focused ? color.actionFill : color.borderStrong;
  return (
    <Stack gap="s2">
      <Text variant="label">{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.r3,
          borderCurve: 'continuous',
          borderWidth: focused || error ? borderWidth.thick : borderWidth.hairline,
          borderColor: border,
          backgroundColor: color.surface,
          paddingHorizontal: space.s4,
          gap: space.s3,
        }}
      >
        {left}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
          placeholderTextColor={color.textMuted}
          {...rest}
          maxFontSizeMultiplier={v.maxScale}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[
            {
              flex: 1,
              minHeight: d.controlHeight,
              color: color.textPrimary,
              fontFamily: fontFamily(v.font, v.weight),
              fontSize: v.size,
              lineHeight: v.lineHeight,
            },
            style,
          ]}
        />
        {right}
      </View>
      {error ? (
        <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint !== undefined ? (
        <Text variant="bodySm" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}
```

`SearchField.tsx`:

```tsx
import { Search, X } from 'lucide-react-native';
import { Pressable } from 'react-native';

import { Icon } from './Icon';
import { Input } from './Input';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  autoCapitalize?: 'none' | 'words';
  testID?: string;
};

export function SearchField({ label, value, onChangeText, placeholder, autoFocus, autoCapitalize = 'none', testID }: Props) {
  return (
    <Input
      testID={testID}
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      autoFocus={autoFocus}
      autoCorrect={false}
      autoComplete="off"
      autoCapitalize={autoCapitalize}
      returnKeyType="search"
      left={<Icon as={Search} size="sm" tone="textMuted" />}
      right={
        value !== '' ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Clear search"
            hitSlop={12}
            onPress={() => {
              onChangeText('');
            }}
          >
            <Icon as={X} size="sm" tone="textSecondary" />
          </Pressable>
        ) : null
      }
    />
  );
}
```

`PinField.tsx`:

```tsx
import { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  length?: number;
  error?: string;
  testID?: string;
};

// One real input (screen readers and autofill see a single secure field); the boxes are visual.
export function PinField({ label, value, onChangeText, length = 6, error, testID }: Props) {
  const d = useDensity();
  const ref = useRef<TextInput>(null);
  return (
    <Stack gap="s2">
      <Text variant="label">{label}</Text>
      <Pressable
        accessible={false}
        onPress={() => ref.current?.focus()}
        style={{ flexDirection: 'row', gap: space.s3 }}
      >
        {Array.from({ length }, (_, i) => (
          <View
            key={i}
            importantForAccessibility="no-hide-descendants"
            accessibilityElementsHidden
            style={{
              flex: 1,
              minHeight: d.controlHeight,
              borderRadius: radius.r3,
              borderWidth: i === value.length ? borderWidth.thick : borderWidth.hairline,
              borderColor: error ? color.status.danger.solid : i === value.length ? color.actionFill : color.borderStrong,
              backgroundColor: color.surface,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {i < value.length ? <Text variant="title">•</Text> : null}
          </View>
        ))}
      </Pressable>
      <TextInput
        ref={ref}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={(t) => {
          onChangeText(t.replace(/\D/g, '').slice(0, length));
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={length}
        autoComplete="off"
        textContentType="none"
        caretHidden
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
      {error ? (
        <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
```

Note: the test calls `changeText(input, '123')` and expects `'123'` — the digit filter passes it through unchanged.

`index.ts`: export `SearchField`, `PinField`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/shared/ui src/features && npx tsc --noEmit && npx expo lint`
Expected: PASS (feature tests using `Input` by label still pass).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui
git commit -m "feat(ui): input hints and accessible errors, search field, PIN field"
```

---

### Task 5: Structure — Screen, Header, Sheet, ListRow, SegmentedControl, Divider

**Files:**
- Modify: `src/shared/ui/Screen.tsx`, `src/shared/ui/index.ts`
- Create: `src/shared/ui/Header.tsx`, `src/shared/ui/Sheet.tsx`, `src/shared/ui/ListRow.tsx`, `src/shared/ui/SegmentedControl.tsx`, `src/shared/ui/Divider.tsx`
- Test: create `src/shared/ui/__tests__/structure.test.tsx`

**Interfaces:**
- Consumes: `useDensity`, `useMotionTier`, `Button`, `Text`, `layout`, `space`.
- Produces:
  - `Screen({ children, scroll?, header?: ReactNode, footer?: ReactNode, bg?: 'canvas'|'surface', refreshControl?: ReactElement })` — footer is sticky with `paddingBottom = max(insets.bottom, space.s5)`; content max width `layout.formMaxWidth` centred on tablets.
  - `Header({ title, left?: ReactNode, right?: ReactNode, subtitle?: string })` — title is `accessibilityRole="header"`, variant `title`.
  - `Sheet({ visible, title, onClose, closeLabel?: string ('Close'), closeDisabled?: boolean, right?: ReactNode, footer?: ReactNode, children, testID?, onRequestClose?: () => void, scroll?: boolean })` — `Modal presentationStyle="pageSheet"`, `animationType` `'slide'` unless tier is `none` (then `'none'`); header row: Close ghost button (left), title (centre-left), `right` slot; body padding `s5`; footer sticky. `onRequestClose` defaults to `onClose` unless `closeDisabled`.
  - `ListRow({ title, subtitle?, leading?: ReactNode, trailing?: ReactNode, onPress?, accessibilityLabel?, testID?, numberOfLines? })` — min height `useDensity().rowMin`, bottom hairline divider; pressable only when `onPress` is set.
  - `SectionHeader({ label, count?, expanded?, onToggle? })` — 40 tall; toggle variant has `accessibilityState={{ expanded }}`.
  - `SegmentedControl<T extends string>({ value: T, options: readonly { value: T; label: string; count?: number }[], onChange: (v: T) => void, testID? })` — `tablist` container, each `tab` with `selected`; accessible name is `label` (count appended as ` (n)` in the visible text and the name, e.g. `To sync (3)`); when `count` is undefined the name is exactly `label`.
  - `Divider()`.

- [ ] **Step 1: Write the failing tests**

`src/shared/ui/__tests__/structure.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ListRow, SectionHeader } from '@/shared/ui/ListRow';
import { SegmentedControl } from '@/shared/ui/SegmentedControl';
import { Sheet } from '@/shared/ui/Sheet';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } };

it('sheet has a header with a working Close and its title', async () => {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Sheet visible title="Activity" onClose={onClose} testID="sheet">
        <Text>Body</Text>
      </Sheet>
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('header', { name: 'Activity' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('sheet close can be disabled while work is in flight', async () => {
  const onClose = jest.fn();
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <Sheet visible title="Find guest" onClose={onClose} closeDisabled>
        <Text>Body</Text>
      </Sheet>
    </SafeAreaProvider>,
  );
  expect(screen.getByRole('button', { name: 'Close' })).toHaveAccessibilityState({ disabled: true });
});

it('segmented control exposes tabs with counts and selection', async () => {
  const onChange = jest.fn();
  await render(
    <SegmentedControl
      value="toSync"
      onChange={onChange}
      options={[
        { value: 'toSync', label: 'To sync', count: 3 },
        { value: 'synced', label: 'Synced' },
      ]}
    />,
  );
  expect(screen.getByRole('tab', { name: 'To sync (3)' })).toHaveAccessibilityState({ selected: true });
  await fireEvent.press(screen.getByRole('tab', { name: 'Synced' }));
  expect(onChange).toHaveBeenCalledWith('synced');
});

it('list row is a button only when pressable', async () => {
  const onPress = jest.fn();
  await render(
    <>
      <ListRow title="VIP · ticket 3" subtitle="14:02" onPress={onPress} />
      <ListRow title="Regular" />
    </>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'VIP · ticket 3, 14:02' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('button', { name: /Regular/ })).toBeNull();
});

it('collapsible section header reports expanded', async () => {
  await render(<SectionHeader label="Earlier" count={2} expanded={false} onToggle={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Earlier (2)' })).toHaveAccessibilityState({ expanded: false });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/shared/ui/__tests__/structure.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`Header.tsx`:

```tsx
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { Text } from './Text';

type Props = { title: string; subtitle?: string; left?: ReactNode; right?: ReactNode };

export function Header({ title, subtitle, left, right }: Props) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3, minHeight: 56 }}>
      {left}
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="title" accessibilityRole="header" numberOfLines={1}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text variant="bodySm" tone="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {right}
    </View>
  );
}
```

`Divider.tsx`:

```tsx
import { View } from 'react-native';

import { color } from '@/shared/theme';

export function Divider() {
  return <View style={{ height: 1, backgroundColor: color.border }} />;
}
```

`Sheet.tsx`:

```tsx
import { useContext, type ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { color, space } from '@/shared/theme';

import { Button } from './Button';
import { useMotionTier } from './motion';
import { Text } from './Text';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  /** Overrides back/swipe-down (defaults to onClose unless closeDisabled). */
  onRequestClose?: () => void;
  right?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
  children: ReactNode;
};

export function Sheet({
  visible,
  title,
  onClose,
  closeLabel = 'Close',
  closeDisabled = false,
  onRequestClose,
  right,
  footer,
  scroll = false,
  testID,
  children,
}: Props) {
  const tier = useMotionTier();
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const body = { padding: space.s5, gap: space.s4 };
  return (
    <Modal
      visible={visible}
      animationType={tier === 'none' ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      testID={testID}
      onRequestClose={onRequestClose ?? (() => {
        if (!closeDisabled) onClose();
      })}
    >
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.surface }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s3,
            paddingHorizontal: space.s3,
            minHeight: 56,
            borderBottomWidth: 1,
            borderBottomColor: color.border,
          }}
        >
          <View style={{ minWidth: 88 }}>
            <Button variant="ghost" label={closeLabel} onPress={onClose} disabled={closeDisabled} />
          </View>
          <Text variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <View style={{ minWidth: 88, alignItems: 'flex-end' }}>{right}</View>
        </View>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            keyboardDismissMode="interactive"
            contentContainerStyle={body}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, body]}>{children}</View>
        )}
        {footer !== undefined ? (
          <View
            style={{
              paddingHorizontal: space.s5,
              paddingTop: space.s3,
              paddingBottom: Math.max(insets.bottom, space.s5),
              gap: space.s3,
              borderTopWidth: 1,
              borderTopColor: color.border,
              backgroundColor: color.surface,
            }}
          >
            {footer}
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}
```

`ListRow.tsx`:

```tsx
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { color, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
  /** Extra line under the subtitle (e.g. a needs-attention reason). */
  note?: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  numberOfLines?: number;
  testID?: string;
};

export function ListRow({ title, subtitle, leading, trailing, note, onPress, accessibilityLabel, numberOfLines = 1, testID }: Props) {
  const d = useDensity();
  const name = accessibilityLabel ?? [title, subtitle].filter((s) => s !== undefined && s !== '').join(', ');
  const content = (
    <>
      {leading}
      <View style={{ flex: 1, gap: space.s1 }}>
        <Text variant="bodyStrong" numberOfLines={numberOfLines}>
          {title}
        </Text>
        {subtitle !== undefined ? (
          <Text variant="bodySm" tone="textSecondary" numberOfLines={numberOfLines}>
            {subtitle}
          </Text>
        ) : null}
        {note}
      </View>
      {trailing}
    </>
  );
  const style = {
    minHeight: d.rowMin,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: space.s4,
    paddingVertical: space.s3,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  };
  if (onPress === undefined)
    return (
      <View testID={testID} accessible accessibilityLabel={name} style={style}>
        {content}
      </View>
    );
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={name}
      onPress={onPress}
      style={({ pressed }) => [style, { backgroundColor: pressed ? color.wash : 'transparent' }]}
    >
      {content}
    </Pressable>
  );
}

type SectionProps = { label: string; count?: number; expanded?: boolean; onToggle?: () => void };

export function SectionHeader({ label, count, expanded, onToggle }: SectionProps) {
  const text = count === undefined ? label : `${label} (${String(count)})`;
  if (onToggle === undefined)
    return (
      <View style={{ minHeight: 40, justifyContent: 'flex-end', paddingBottom: space.s2 }}>
        <Text variant="label" tone="textSecondary" accessibilityRole="header">
          {text}
        </Text>
      </View>
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text}
      accessibilityState={{ expanded: expanded === true }}
      onPress={onToggle}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.s2 }}
    >
      <Text variant="label" tone="textSecondary" style={{ flex: 1 }}>
        {text}
      </Text>
      <Icon as={expanded === true ? ChevronDown : ChevronRight} size="sm" tone="textSecondary" />
    </Pressable>
  );
}
```

`SegmentedControl.tsx`:

```tsx
import { Pressable, View } from 'react-native';

import { color, radius, space } from '@/shared/theme';

import { Text } from './Text';

type Option<T extends string> = { value: T; label: string; count?: number };
type Props<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  testID?: string;
};

const nameOf = <T extends string>(o: Option<T>) =>
  o.count === undefined ? o.label : `${o.label} (${String(o.count)})`;

export function SegmentedControl<T extends string>({ value, options, onChange, testID }: Props<T>) {
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', backgroundColor: color.wash, borderRadius: radius.r3, padding: space.s1, gap: space.s1 }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={nameOf(o)}
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(o.value);
            }}
            style={{
              flex: 1,
              minHeight: 44,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.s2,
              borderRadius: radius.r2,
              backgroundColor: selected ? color.surface : 'transparent',
              borderWidth: 1,
              borderColor: selected ? color.border : 'transparent',
            }}
          >
            <Text variant="label" tone={selected ? 'textPrimary' : 'textSecondary'} numberOfLines={2} align="center" maxScale={1.3}>
              {nameOf(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
```

`Screen.tsx` — full replacement:

```tsx
import { useContext, type ReactElement, type ReactNode } from 'react';
import { ScrollView, View, type RefreshControlProps } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { color, layout, space } from '@/shared/theme';

type Props = {
  children: ReactNode;
  scroll?: boolean;
  header?: ReactNode;
  /** Sticky bottom area (primary action in the thumb zone). */
  footer?: ReactNode;
  bg?: 'canvas' | 'surface';
  refreshControl?: ReactElement<RefreshControlProps>;
};

export function Screen({ children, scroll, header, footer, bg = 'canvas', refreshControl }: Props) {
  const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };
  const body = {
    paddingHorizontal: space.s5,
    paddingVertical: space.s5,
    gap: space.s5,
    width: '100%' as const,
    maxWidth: layout.formMaxWidth,
    alignSelf: 'center' as const,
  };
  return (
    <SafeAreaView edges={footer !== undefined ? ['top'] : ['top', 'bottom']} style={{ flex: 1, backgroundColor: color[bg] }}>
      {header !== undefined ? <View style={{ paddingHorizontal: space.s5 }}>{header}</View> : null}
      {scroll ? (
        <ScrollView
          contentContainerStyle={body}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          refreshControl={refreshControl}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
      {footer !== undefined ? (
        <View style={{ paddingHorizontal: space.s5, paddingTop: space.s3, paddingBottom: Math.max(insets.bottom, space.s5), gap: space.s3 }}>
          {footer}
        </View>
      ) : null}
    </SafeAreaView>
  );
}
```

`index.ts`: export `Header`, `Sheet`, `ListRow`, `SectionHeader`, `SegmentedControl`, `Divider`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/shared/ui src/features src/app && npx tsc --noEmit && npx expo lint`
Expected: PASS (existing `Screen` callers keep working: `scroll` and `children` unchanged).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui
git commit -m "feat(ui): screen header and sticky footer, sheet, list row, section header, segmented control, divider"
```

---

### Task 6: Status and states — StatusPill, Banner, EmptyState, ErrorState, Skeleton, Illustration, SuccessMark

**Files:**
- Create: `src/shared/ui/StatusPill.tsx`, `src/shared/ui/Banner.tsx`, `src/shared/ui/EmptyState.tsx`, `src/shared/ui/ErrorState.tsx`, `src/shared/ui/Skeleton.tsx`, `src/shared/ui/Illustration.tsx`, `src/shared/ui/SuccessMark.tsx`
- Modify: `src/shared/ui/ScreenError.tsx`, `src/shared/ui/index.ts`, `src/features/auth/screens/SignInScreen.tsx`
- Test: create `src/shared/ui/__tests__/states.test.tsx`; update `src/shared/ui/__tests__/ScreenError.test.tsx`; `src/features/auth/screens/__tests__/SignInScreen.test.tsx` if it asserts the error colour

**Interfaces:**
- Consumes: `StatusTone`, `textTone`, `surfaceTone`, `useMotionTier`, `Button`, `Icon`, `motion`.
- Produces:
  - `StatusPill({ tone: StatusTone, label: string, icon?: LucideIcon, onPress?: () => void, accessibilityLabel?: string, size?: 'sm'|'md', testID?, onFill?: boolean })` — `onFill` renders a translucent-free outline pill for coloured outcome fills (white or ink border/text chosen by the caller via `tone` ignored → uses `onInverse`). When `onPress` is set it is a button with min height 44 (`md`) / 32 visual + hitSlop (`sm`).
  - `Banner({ tone: StatusTone, title?: string, message: string, action?: { label: string; onPress: () => void }, live?: 'polite'|'assertive' })`.
  - `EmptyState({ illustration?: IllustrationName, icon?: LucideIcon, title: string, message?: string, action?: { label: string; onPress: () => void } })`.
  - `ErrorState({ title: string, message?: string, safeLine?: string, onRetry?: () => void, retryLabel?: string })` — `safeLine` is shown only when passed (never assumed).
  - `Skeleton({ width?: number | `${number}%`, height: number, radius?: RadiusKey, delayMs?: number (150) })` and `SkeletonRows({ count: number })`.
  - `type IllustrationName = 'camera' | 'noEvents' | 'offline' | 'search'`; `Illustration({ name, size?: number (160) })`.
  - `SuccessMark({ size?: number (96), animate?: boolean })` — circle + check drawn in SVG; stroke draws in 400 ms on tier `full` when `animate`, static otherwise.

- [ ] **Step 1: Write the failing tests**

`src/shared/ui/__tests__/states.test.tsx`:

```tsx
import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import { color } from '@/shared/theme';
import { Banner } from '@/shared/ui/Banner';
import { EmptyState } from '@/shared/ui/EmptyState';
import { ErrorState } from '@/shared/ui/ErrorState';
import { Skeleton } from '@/shared/ui/Skeleton';
import { StatusPill } from '@/shared/ui/StatusPill';

beforeEach(() => {
  jest.useFakeTimers();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
});
afterEach(() => {
  jest.useRealTimers();
});

it('status pill uses its tone, never violet', async () => {
  await render(<StatusPill tone="success" label="In · 22 min ago" />);
  expect(screen.getByTestId('status-pill')).toHaveStyle({ backgroundColor: color.status.success.bg });
  expect(screen.getByText('In · 22 min ago')).toHaveStyle({ color: color.status.success.fg });
});

it('a pressable pill is a button', async () => {
  const onPress = jest.fn();
  await render(<StatusPill tone="warning" label="1 needs attention" onPress={onPress} />);
  expect(screen.getByRole('button', { name: '1 needs attention' })).toBeTruthy();
});

it('neutral banner for a transient failure is not red', async () => {
  await render(<Banner tone="neutral" message="We couldn't reach the server" />);
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.neutral.bg });
});

it('empty state shows reason and one action', async () => {
  const onPress = jest.fn();
  await render(<EmptyState icon={undefined} title="No events assigned" message="Ask the organiser." action={{ label: 'Refresh', onPress }} />);
  expect(screen.getByText('No events assigned')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
});

it('error state only claims data is safe when told', async () => {
  const { rerender } = await render(<ErrorState title="Couldn't load events" onRetry={jest.fn()} />);
  expect(screen.queryByText(/safe/i)).toBeNull();
  await rerender(<ErrorState title="Couldn't load events" safeLine="Offline lists on this phone still work" onRetry={jest.fn()} />);
  expect(screen.getByText('Offline lists on this phone still work')).toBeTruthy();
});

it('skeleton appears only after 150 ms', async () => {
  await render(<Skeleton height={20} />);
  expect(screen.queryByTestId('skeleton')).toBeNull();
  await act(() => {
    jest.advanceTimersByTime(150);
  });
  expect(screen.getByTestId('skeleton')).toBeTruthy();
});

it('skeleton is static under Reduce Motion', async () => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  await render(<Skeleton height={20} delayMs={0} />);
  await act(async () => {
    await Promise.resolve();
  });
  expect(screen.getByTestId('skeleton').props.accessibilityHint).toBe('static');
});
```

Update `ScreenError.test.tsx`: replace any assertion on "Your data is safe. Try again." with an assertion that the text `Something went wrong` and a `Try again` button exist and that `/safe/i` is absent.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/shared/ui/__tests__/states.test.tsx src/shared/ui/__tests__/ScreenError.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`StatusPill.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { color, radius, space, type StatusTone } from '@/shared/theme';

import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  tone: StatusTone;
  label: string;
  icon?: LucideIcon;
  onPress?: () => void;
  accessibilityLabel?: string;
  /** On a gate outcome fill: outline in the fill's foreground colour. */
  onFill?: string;
  testID?: string;
};

const FG = { neutral: 'neutralFg', info: 'infoFg', success: 'successFg', warning: 'warningFg', danger: 'dangerFg' } as const;

export function StatusPill({ tone, label, icon, onPress, accessibilityLabel, onFill, testID = 'status-pill' }: Props) {
  const s = color.status[tone];
  const face = (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: space.s2,
        paddingHorizontal: space.s3,
        paddingVertical: space.s2,
        borderRadius: radius.rFull,
        backgroundColor: onFill === undefined ? s.bg : 'transparent',
        borderWidth: onFill === undefined ? 0 : 2,
        borderColor: onFill,
      }}
    >
      {icon !== undefined ? <Icon as={icon} size="xs" tone={FG[tone]} color={onFill} /> : null}
      <Text variant="labelSm" tone={FG[tone]} style={onFill === undefined ? undefined : { color: onFill }} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
  if (onPress === undefined) return face;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={{ minHeight: 44, justifyContent: 'center' }}
    >
      {face}
    </Pressable>
  );
}
```

`Banner.tsx`:

```tsx
import { CircleAlert, Info, TriangleAlert, WifiOff } from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius, space, type StatusTone } from '@/shared/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

const GLYPH = { neutral: WifiOff, info: Info, success: Info, warning: TriangleAlert, danger: CircleAlert } as const;
const FG = { neutral: 'neutralFg', info: 'infoFg', success: 'successFg', warning: 'warningFg', danger: 'dangerFg' } as const;

type Props = {
  tone: StatusTone;
  title?: string;
  message: string;
  action?: { label: string; onPress: () => void };
  live?: 'polite' | 'assertive';
};

export function Banner({ tone, title, message, action, live = 'polite' }: Props) {
  return (
    <View
      testID="banner"
      accessibilityLiveRegion={live}
      style={{ flexDirection: 'row', gap: space.s3, padding: space.s4, borderRadius: radius.r3, backgroundColor: color.status[tone].bg }}
    >
      <Icon as={GLYPH[tone]} size="sm" tone={FG[tone]} />
      <View style={{ flex: 1, gap: space.s2 }}>
        {title !== undefined ? (
          <Text variant="bodyStrong" tone={FG[tone]}>
            {title}
          </Text>
        ) : null}
        <Text variant="bodySm" tone={FG[tone]}>
          {message}
        </Text>
        {action !== undefined ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
      </View>
    </View>
  );
}
```

`Illustration.tsx` (SVG scenes; colours by role; replaceable by Lottie later per MOTION M6):

```tsx
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { color } from '@/shared/theme';

export type IllustrationName = 'camera' | 'noEvents' | 'offline' | 'search';

// Flat, violet/ink/wash only. Same name + size API a commissioned Lottie file will slot into.
export function Illustration({ name, size = 160 }: { name: IllustrationName; size?: number }) {
  const ink = color.textPrimary;
  const violet = color.actionFill;
  const wash = color.selectedWash;
  return (
    <Svg width={size} height={size} viewBox="0 0 160 160" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={80} cy={80} r={72} fill={wash} />
      {name === 'camera' ? (
        <>
          <Rect x={36} y={56} width={88} height={60} rx={12} fill={color.surface} stroke={ink} strokeWidth={3} />
          <Rect x={60} y={46} width={40} height={14} rx={4} fill={ink} />
          <Circle cx={80} cy={86} r={18} fill={wash} stroke={violet} strokeWidth={4} />
          <Circle cx={80} cy={86} r={7} fill={violet} />
        </>
      ) : null}
      {name === 'noEvents' ? (
        <>
          <Rect x={42} y={44} width={76} height={76} rx={10} fill={color.surface} stroke={ink} strokeWidth={3} />
          <Rect x={42} y={44} width={76} height={18} rx={10} fill={violet} />
          <Path d="M62 90h36M62 104h22" stroke={ink} strokeWidth={4} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'offline' ? (
        <>
          <Path d="M40 74a56 56 0 0 1 80 0M52 88a38 38 0 0 1 56 0M66 102a18 18 0 0 1 28 0" stroke={ink} strokeWidth={5} strokeLinecap="round" fill="none" />
          <Circle cx={80} cy={116} r={6} fill={violet} />
          <Path d="M46 46l68 68" stroke={violet} strokeWidth={5} strokeLinecap="round" />
        </>
      ) : null}
      {name === 'search' ? (
        <>
          <Circle cx={72} cy={72} r={26} fill={color.surface} stroke={ink} strokeWidth={5} />
          <Path d="M92 92l22 22" stroke={violet} strokeWidth={8} strokeLinecap="round" />
        </>
      ) : null}
    </Svg>
  );
}
```

`SuccessMark.tsx`:

```tsx
import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { color, motion } from '@/shared/theme';

import { useMotionTier } from './motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 60;

// Inventory #7 fallback: a drawn check, static unless tier is full and `animate` is set.
export function SuccessMark({ size = 96, animate = false }: { size?: number; animate?: boolean }) {
  const tier = useMotionTier();
  const run = animate && tier === 'full';
  const offset = useSharedValue(run ? CHECK_LENGTH : 0);
  useEffect(() => {
    if (run) offset.value = withTiming(0, { duration: motion.duration.slow - 100 });
  }, [run, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.value }));
  return (
    <Svg width={size} height={size} viewBox="0 0 96 96" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Circle cx={48} cy={48} r={44} fill={color.status.success.solid} />
      <AnimatedPath
        d="M28 50l14 14 26-30"
        stroke={color.onAction}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={CHECK_LENGTH}
        animatedProps={props}
      />
    </Svg>
  );
}
```

`Skeleton.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';

import { color, radius as radii, space, type RadiusKey } from '@/shared/theme';

import { useMotionTier } from './motion';

type Props = { width?: number | `${number}%`; height: number; radius?: RadiusKey; delayMs?: number };

// DESIGN_SYSTEM §6: only after 150 ms; pulses only on `full`, static otherwise.
export function Skeleton({ width = '100%', height, radius = 'r2', delayMs = 150 }: Props) {
  const tier = useMotionTier();
  const [shown, setShown] = useState(delayMs === 0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => {
      setShown(true);
    }, delayMs);
    return () => {
      clearTimeout(t);
    };
  }, [delayMs]);
  useEffect(() => {
    if (shown && tier === 'full') opacity.value = withRepeat(withTiming(0.5, { duration: 600 }), -1, true);
    else opacity.value = 1;
  }, [shown, tier, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  if (!shown) return null;
  return (
    <Animated.View
      testID="skeleton"
      accessibilityHint={tier === 'full' ? 'pulse' : 'static'}
      style={[{ width, height, borderRadius: radii[radius], backgroundColor: color.wash }, style]}
    />
  );
}

export function SkeletonRows({ count }: { count: number }) {
  return (
    <View accessibilityLabel="Loading" style={{ gap: space.s4 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.s4, alignItems: 'center' }}>
          <Skeleton width={48} height={48} radius="r3" />
          <View style={{ flex: 1, gap: space.s2 }}>
            <Skeleton height={16} width="70%" />
            <Skeleton height={12} width="45%" />
          </View>
        </View>
      ))}
    </View>
  );
}
```

`EmptyState.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Illustration, type IllustrationName } from './Illustration';
import { Text } from './Text';

type Props = {
  illustration?: IllustrationName;
  icon?: LucideIcon | undefined;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
};

export function EmptyState({ illustration, icon, title, message, action }: Props) {
  return (
    <View style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s9 }}>
      {illustration !== undefined ? <Illustration name={illustration} size={128} /> : icon !== undefined ? <Icon as={icon} size="lg" tone="textMuted" /> : null}
      <Text variant="headline" align="center" accessibilityLiveRegion="polite">
        {title}
      </Text>
      {message !== undefined ? (
        <Text variant="body" tone="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {action !== undefined ? <Button variant="secondary" label={action.label} onPress={action.onPress} /> : null}
    </View>
  );
}
```

`ErrorState.tsx`:

```tsx
import { CircleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = { title: string; message?: string; safeLine?: string; onRetry?: () => void; retryLabel?: string };

// DESIGN_SYSTEM §6: what happened, whether data is safe (only when known), next step.
export function ErrorState({ title, message, safeLine, onRetry, retryLabel = 'Try again' }: Props) {
  return (
    <View style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s8 }}>
      <Icon as={CircleAlert} size="lg" tone="textSecondary" />
      <Text variant="headline" align="center" accessibilityLiveRegion="polite">
        {title}
      </Text>
      {message !== undefined ? (
        <Text variant="body" tone="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {safeLine !== undefined ? (
        <Text variant="bodySm" tone="successFg" align="center">
          {safeLine}
        </Text>
      ) : null}
      {onRetry !== undefined ? <Button label={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
}
```

`ScreenError.tsx`: replace the body text `Your data is safe. Try again.` with `Something didn't load. Try again, or restart the app if it keeps happening.` (keep the title, the `captureException` effect and the `Try again` button).

`SignInScreen.tsx`: read the file; where the transient errors (network, rate limit, server) are rendered in a danger-styled box (audit lines ~81–91), render them with `<Banner tone="neutral" message={…} live="assertive" />` instead; keep credential errors (wrong email/password) as `<Banner tone="danger" …/>`. Keep every message string unchanged. If `SignInScreen.test.tsx` asserts a danger colour on a transient error, change it to assert `color.status.neutral.bg` on `getByTestId('banner')`.

`index.ts`: export `StatusPill`, `Banner`, `EmptyState`, `ErrorState`, `Skeleton`, `SkeletonRows`, `Illustration`, `type IllustrationName`, `SuccessMark`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/shared/ui src/features/auth && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui src/features/auth/screens
git commit -m "feat(ui): status pill, banner, empty and error states, skeleton, SVG illustrations and success mark; neutral transient sign-in errors"
```

---

### Task 7: OutcomeScreen in the kit; fixable refusals become red

**Files:**
- Create: `src/shared/ui/OutcomeScreen.tsx`
- Modify: `src/features/gate/domain/present.ts`, `src/features/gate/ui/OutcomeOverlay.tsx`, `src/shared/ui/index.ts`
- Test: `src/features/gate/domain/__tests__/present.test.ts`, `src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx`

**Interfaces:**
- Consumes: `Button` (`onInverse`), `StatusPill` (`onFill`), `Spinner`, `color.outcome`, `typeVariants.outcome`, `iconSize.xxl`.
- Produces:
  - `type OutcomeTone = 'admitted' | 'used' | 'refused' | 'retry'`.
  - `OutcomeScreen({ tone: OutcomeTone, icon: LucideIcon, title: string, lines: { text: string; size: 'detail' | 'secondary' }[], tags: string[], announced: string, onBackdropPress?: () => void, actions?: ReactNode, iconTestID?: string, testID?: string })` — fixed layout, `maxScale 1`, content in the lower two-thirds, one assertive alert block.
  - `OutcomeAction({ label, onPress, primary?: boolean, disabled?: boolean, busy?: boolean, fg: 'light' | 'dark' })` exported from the same file: wraps `Button` with `onInverse` (primary → filled white, else outline).
  - `present()` change: `refused` with `fixable` → `tone: 'refused'`, `cue: 'error'`.

- [ ] **Step 1: Write the failing tests**

In `present.test.ts`, find the test(s) asserting a fixable refusal has `tone: 'used'` / `cue: 'warning'` and change the expectation to:

```ts
expect(present(fixableExpired, NOW)).toMatchObject({ tone: 'refused', cue: 'error', title: 'Refused' });
```

(Use the fixture the file already builds for a fixable refusal; if none exists, add `const fixableExpired: ScanOutcome = { kind: 'refused', reason: 'expired', fixable: true };` matching the `ScanOutcome` type in `outcome.ts`.)

Add to `OutcomeOverlay.test.tsx`:

```tsx
it.each([
  ['admitted', color.outcome.admitted.bg],
  ['used', color.outcome.used.bg],
  ['refused', color.outcome.refused.bg],
  ['retry', color.outcome.retry.bg],
] as const)('%s fills the screen with its colour', async (tone, bg) => {
  await render(<OutcomeOverlay {...propsFor(tone)} />);
  expect(screen.getByTestId('outcome-overlay')).toHaveStyle({ backgroundColor: bg });
});

it('a fixable refusal is red, not amber', async () => {
  await render(<OutcomeOverlay {...propsForOutcome({ kind: 'refused', reason: 'staticNotAllowed', fixable: true })} />);
  expect(screen.getByTestId('outcome-overlay')).toHaveStyle({ backgroundColor: color.outcome.refused.bg });
});

it('the title uses the sans outcome type, not serif', async () => {
  await render(<OutcomeOverlay {...propsFor('admitted')} />);
  expect(screen.getByText('Admitted')).toHaveStyle({ fontSize: 36 });
});

it('while an override records, the override action is busy and Done is disabled', async () => {
  await render(<OutcomeOverlay {...notInListProps} overrideState={{ kind: 'open' }} overrideStatus="busy" onOverride={jest.fn()} />);
  expect(screen.getByRole('button', { name: 'Overriding…' })).toHaveAccessibilityState({ busy: true, disabled: true });
  expect(screen.getByRole('button', { name: 'Done' })).toHaveAccessibilityState({ disabled: true });
});
```

`propsFor`, `propsForOutcome` and `notInListProps` are helpers: read the existing test file, reuse its fixture builders (it already renders each outcome and the not-in-list override case) and add these three small helpers around them. The existing tests stay; update only those that asserted the fixable amber or the serif `display` variant.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/gate/domain/__tests__/present.test.ts src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx`
Expected: FAIL (fixable still amber, title still 40 serif, override not busy-state).

- [ ] **Step 3: Implement**

`present.ts`, `case 'refused'`: change

```ts
        tone: o.fixable ? 'used' : 'refused',
        cue: o.fixable ? 'warning' : 'error',
```

to

```ts
        // Amber means "Already used" only; a fixable refusal is a refusal with an instruction.
        tone: 'refused',
        cue: 'error',
```

`src/shared/ui/OutcomeScreen.tsx`:

```tsx
import type { LucideIcon } from 'lucide-react-native';
import { useContext, type ReactNode } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { color, density, iconSize, space } from '@/shared/theme';

import { Button } from './Button';
import { StatusPill } from './StatusPill';
import { Text } from './Text';

export type OutcomeTone = 'admitted' | 'used' | 'refused' | 'retry';

// Gate results never grow with Dynamic Type: the actions must stay on screen.
const SCALE = 1;

type Props = {
  tone: OutcomeTone;
  icon: LucideIcon;
  title: string;
  lines: { text: string; size: 'detail' | 'secondary' }[];
  tags: string[];
  /** Everything a screen reader should hear, in order. */
  announced: string;
  onBackdropPress?: () => void;
  actions?: ReactNode;
  iconTestID?: string;
  testID?: string;
};

// D9 solid fills, no entrance animation. The full-bleed Pressable is not an accessibility
// element (iOS would collapse the buttons into it); the alert is the inner result block.
export function OutcomeScreen({ tone, icon: Glyph, title, lines, tags, announced, onBackdropPress, actions, iconTestID, testID }: Props) {
  const { bg, fg } = color.outcome[tone];
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  return (
    <Pressable
      testID={testID}
      accessible={false}
      onPress={onBackdropPress}
      style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: bg }}
    >
      <View
        testID="outcome-content"
        style={{ flex: 1, padding: space.s7, paddingTop: insets.top + space.s9, paddingBottom: insets.bottom + space.s7 }}
      >
        <ScrollView style={{ flexGrow: 0, flexShrink: 1, marginTop: 'auto' }}>
          <View accessible accessibilityRole="alert" accessibilityLiveRegion="assertive" accessibilityLabel={announced} style={{ gap: space.s5 }}>
            <View testID={iconTestID}>
              <Glyph size={iconSize.xxl} color={fg} strokeWidth={2} />
            </View>
            <Text variant="outcome" maxScale={SCALE} style={{ color: fg }}>
              {title}
            </Text>
            {lines.map((l) => (
              <Text key={l.text} variant={l.size === 'detail' ? 'titleLg' : 'headline'} maxScale={SCALE} style={{ color: fg }}>
                {l.text}
              </Text>
            ))}
            {tags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
                {tags.map((t) => (
                  <StatusPill key={t} tone="neutral" label={t} onFill={fg} testID={`outcome-tag-${t}`} />
                ))}
              </View>
            ) : null}
          </View>
        </ScrollView>
        {actions !== undefined ? (
          <View testID="outcome-actions" style={{ paddingTop: space.s7, gap: density.gate.targetGap }}>
            {actions}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

type ActionProps = { label: string; onPress: () => void; primary?: boolean; disabled?: boolean; busy?: boolean; dark?: boolean };

// `dark` on the amber "Already used" fill: white text there fails contrast, so ink is used.
export function OutcomeAction({ label, onPress, primary = false, disabled, busy, dark = false }: ActionProps) {
  return (
    <Button
      label={label}
      onPress={onPress}
      variant={primary ? 'primary' : 'secondary'}
      onInverse={dark ? 'dark' : 'light'}
      disabled={disabled}
      loading={busy}
    />
  );
}
```

OutcomeOverlay passes `dark` when `tone === 'used'`.

`OutcomeOverlay.tsx`: keep the props, `present`, the override logic (`overridable`, `offerOverride`, `lockLine`, `failLine`, `busy`) and `announced`; replace the render with `OutcomeScreen`:

```tsx
import { CircleCheck, Clock, OctagonX, RotateCw, WifiOff } from 'lucide-react-native';

import { OutcomeAction, OutcomeScreen } from '@/shared/ui';

const glyphFor = (tone: Tone, cause: string | null) =>
  tone === 'admitted' ? CircleCheck
    : tone === 'used' ? Clock
    : tone === 'refused' ? OctagonX
    : cause === 'network' || cause === 'timeout' || cause === 'noOfflineList' ? WifiOff
    : RotateCw;
```

with `cause = view.outcome.kind === 'couldntCheck' ? view.outcome.cause : null`, and

```tsx
  const lines = [
    ...(p.detail !== '' ? [{ text: p.detail, size: 'detail' as const }] : []),
    ...[p.secondary, chip, lockLine, failLine]
      .filter((s): s is string => s !== null && s !== '')
      .map((text) => ({ text, size: 'secondary' as const })),
  ];
  const dark = tone === 'used';
  return (
    <OutcomeScreen
      testID="outcome-overlay"
      tone={tone}
      icon={glyphFor(tone, cause)}
      iconTestID={`outcome-icon-${p.title}`}
      title={p.title}
      lines={lines}
      tags={p.tag !== null ? [p.tag] : []}
      announced={announced}
      onBackdropPress={p.holdMs === null ? undefined : dismiss}
      actions={
        p.action === null ? undefined : (
          <>
            {offerOverride ? (
              <OutcomeAction dark={dark} label={busy ? 'Overriding…' : 'Supervisor override'} busy={busy} disabled={busy} onPress={() => { onOverride(view.id); }} />
            ) : null}
            {p.action === 'tryAgain' ? <OutcomeAction dark={dark} primary label="Try again" onPress={() => { onTryAgain(view.id); }} /> : null}
            {p.action === 'signIn' ? <OutcomeAction dark={dark} primary label="Sign in again" onPress={onSignIn} /> : null}
            {p.action === 'done' ? <OutcomeAction dark={dark} primary label="Done" disabled={busy} onPress={dismiss} /> : null}
            {p.action === 'tryAgain' || p.action === 'signIn' ? <OutcomeAction dark={dark} label="Dismiss" onPress={dismiss} /> : null}
          </>
        )
      }
    />
  );
```

(With `loading`, `Button` keeps the label visible, so `getByRole('button', { name: 'Overriding…' })` still finds it.)

Order change: "Supervisor override" now sits above the primary action (spec §4.4); the primary is last, nearest the thumb.

`index.ts`: export `OutcomeScreen`, `OutcomeAction`, `type OutcomeTone`.

Add a contrast check to `contrast.test.ts`: `[color.textPrimary, color.outcome.used.bg]` already covered by `outcome.used.fg`; add `it('white button text on ink fill', …)` → `contrastRatio(color.onInverse, color.textPrimary) >= 7`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/gate src/shared && npx tsc --noEmit && npx expo lint`
Expected: PASS. Any existing ScannerScreen test asserting amber for a fixable refusal is updated to red (spec §5.1).

- [ ] **Step 5: Commit**

```bash
git add src/shared/ui src/shared/theme/__tests__/contrast.test.ts src/features/gate/domain/present.ts src/features/gate/domain/__tests__/present.test.ts src/features/gate/ui/OutcomeOverlay.tsx src/features/gate/ui/__tests__/OutcomeOverlay.test.tsx
git commit -m "feat(gate): outcome screen in the kit with sans titles and per-outcome icons; fixable refusals are red"
```

---

### Task 8: Status pill domain (replaces the sync line)

**Files:**
- Create: `src/features/gate/domain/statusPill.ts`
- Modify: `src/features/gate/domain/syncLine.ts` (remove `syncLine`, `SyncLine`, `clockWarning`, `STALE_CLOCK_MS` — moved), `src/features/gate/domain/__tests__/syncLine.test.ts` (drop the `syncLine` cases, keep `attentionLine`/`groupDigits` cases)
- Test: create `src/features/gate/domain/__tests__/statusPill.test.ts`

**Interfaces:**
- Consumes: `SyncStatus`, `EMPTY_SYNC`, `groupDigits` from `syncLine.ts`; `ago` from `./ago`; `ActivityTab` type from `@/features/gate/offline/outboxStore` (type-only import is allowed in domain).
- Produces:

```ts
export type PillKind = 'blocked' | 'attention' | 'clock' | 'syncing' | 'offline' | 'downloading' | 'online';
export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type StatusPillView = {
  kind: PillKind;
  tone: PillTone;
  text: string;
  /** Activity tab the pill opens. */
  tab: ActivityTab;
  /** Changes only when the state changes (never on "2 min ago" ticks): the live region keys on it. */
  announceKey: string;
};
export function statusPill(s: SyncStatus, nowMs: number): StatusPillView;
```

Priority (first match wins): `blocked` (danger, "Removed from this event — admissions can’t be sent") › `attention` (warning, "N need(s) attention") › `clock` (warning, suspect → "Phone time changed — connect to re-check"; stale > 12 h → "Time last checked N h ago") › `syncing` (info, "Syncing N…", only when `syncing && pending > 0`) › `offline` (neutral; no list → "Offline · no offline list"; else pending > 0 → "Offline · N to sync", else "Offline · deciding on this phone") › `downloading` (info, "Downloading list 4,000 of 12,500", only when `download !== null && list === null`) › `online` (success; no list → "Online · no offline list yet"; pending > 0 → "Online · list 2 min ago · N to sync"; else "Online · list 2 min ago").
`tab`: `attention` kind → `'attention'`; otherwise `pending > 0 ? 'toSync' : 'synced'`.
`announceKey`: `${kind}` plus `:${pending}` for `offline`/`syncing`/`attention` (counts matter), never the time text.

- [ ] **Step 1: Write the failing tests**

`src/features/gate/domain/__tests__/statusPill.test.ts`:

```ts
import { statusPill } from '@/features/gate/domain/statusPill';
import { EMPTY_SYNC, type SyncStatus } from '@/features/gate/domain/syncLine';

const NOW = Date.parse('2026-10-08T18:00:00Z');
const list = { count: 1240, syncedAt: NOW - 2 * 60_000 };
const s = (p: Partial<SyncStatus>): SyncStatus => ({ ...EMPTY_SYNC, ...p });

describe('statusPill priority', () => {
  it('blocked beats everything', () => {
    expect(statusPill(s({ blocked: true, attention: 2, mode: 'offline' }), NOW)).toMatchObject({ kind: 'blocked', tone: 'danger' });
  });
  it('needs attention beats the clock and offline', () => {
    expect(statusPill(s({ attention: 1, mode: 'offline', clock: { suspect: true, checkedAgoMs: 0 } }), NOW)).toMatchObject({
      kind: 'attention',
      tone: 'warning',
      text: '1 needs attention',
      tab: 'attention',
    });
    expect(statusPill(s({ attention: 3 }), NOW).text).toBe('3 need attention');
  });
  it('a changed clock beats syncing', () => {
    expect(statusPill(s({ clock: { suspect: true, checkedAgoMs: 0 }, syncing: true, pending: 2 }), NOW)).toMatchObject({
      kind: 'clock',
      text: 'Phone time changed — connect to re-check',
    });
  });
  it('a clock not checked for over 12 h warns', () => {
    expect(statusPill(s({ clock: { suspect: false, checkedAgoMs: 14 * 3_600_000 }, list }), NOW).text).toBe('Time last checked 14 h ago');
  });
  it('syncing shows the count', () => {
    expect(statusPill(s({ syncing: true, pending: 2, list }), NOW)).toMatchObject({ kind: 'syncing', tone: 'info', text: 'Syncing 2…', tab: 'toSync' });
  });
  it('offline with and without things to sync, and with no list', () => {
    expect(statusPill(s({ mode: 'offline', list, pending: 3 }), NOW)).toMatchObject({ kind: 'offline', tone: 'neutral', text: 'Offline · 3 to sync', tab: 'toSync' });
    expect(statusPill(s({ mode: 'offline', list }), NOW).text).toBe('Offline · deciding on this phone');
    expect(statusPill(s({ mode: 'offline' }), NOW).text).toBe('Offline · no offline list');
  });
  it('downloading only before the first list', () => {
    expect(statusPill(s({ download: { done: 4000, total: 12500 } }), NOW)).toMatchObject({ kind: 'downloading', text: 'Downloading list 4,000 of 12,500' });
    expect(statusPill(s({ download: { done: 10, total: 20 }, list }), NOW).kind).toBe('online');
  });
  it('online shows list freshness and anything to sync', () => {
    expect(statusPill(s({ list }), NOW)).toMatchObject({ kind: 'online', tone: 'success', text: 'Online · list 2 min ago', tab: 'synced' });
    expect(statusPill(s({ list, pending: 1 }), NOW).text).toBe('Online · list 2 min ago · 1 to sync');
    expect(statusPill(s({}), NOW).text).toBe('Online · no offline list yet');
  });
});

describe('announceKey', () => {
  it('does not change when only the time text changes', () => {
    const a = statusPill(s({ list }), NOW);
    const b = statusPill(s({ list }), NOW + 60_000);
    expect(a.text).not.toBe(b.text);
    expect(a.announceKey).toBe(b.announceKey);
  });
  it('changes when the count to sync changes offline', () => {
    expect(statusPill(s({ mode: 'offline', list, pending: 1 }), NOW).announceKey).not.toBe(
      statusPill(s({ mode: 'offline', list, pending: 2 }), NOW).announceKey,
    );
  });
});
```

Check `ago()`'s exact wording in `src/features/gate/domain/ago.ts` before running: if it returns `2 min ago` the test strings hold; otherwise align the expected strings with its output (do not change `ago`).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/gate/domain/__tests__/statusPill.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

`src/features/gate/domain/statusPill.ts`:

```ts
import type { ActivityTab } from '@/features/gate/offline/outboxStore';

import { ago } from './ago';
import { groupDigits, type SyncStatus } from './syncLine';

export type PillKind = 'blocked' | 'attention' | 'clock' | 'syncing' | 'offline' | 'downloading' | 'online';
export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type StatusPillView = { kind: PillKind; tone: PillTone; text: string; tab: ActivityTab; announceKey: string };

const STALE_CLOCK_MS = 12 * 3_600_000;

function clockText(s: SyncStatus): string | null {
  if (s.clock.suspect) return 'Phone time changed — connect to re-check';
  const a = s.clock.checkedAgoMs;
  if (a !== null && a > STALE_CLOCK_MS) return `Time last checked ${String(Math.floor(a / 3_600_000))} h ago`;
  return null;
}

// FR-3.9: one always-visible line. The most important state wins; Activity holds the rest.
export function statusPill(s: SyncStatus, nowMs: number): StatusPillView {
  const tab: ActivityTab = s.pending > 0 ? 'toSync' : 'synced';
  const view = (kind: PillKind, tone: PillTone, text: string, counted = false): StatusPillView => ({
    kind,
    tone,
    text,
    tab: kind === 'attention' ? 'attention' : tab,
    announceKey: counted ? `${kind}:${String(kind === 'attention' ? s.attention : s.pending)}` : kind,
  });
  if (s.blocked) return view('blocked', 'danger', 'Removed from this event — admissions can’t be sent');
  if (s.attention > 0)
    return view('attention', 'warning', `${String(s.attention)} ${s.attention === 1 ? 'needs' : 'need'} attention`, true);
  const clock = clockText(s);
  if (clock !== null) return view('clock', 'warning', clock);
  if (s.syncing && s.pending > 0) return view('syncing', 'info', `Syncing ${String(s.pending)}…`, true);
  if (s.mode === 'offline') {
    if (s.list === null) return view('offline', 'neutral', 'Offline · no offline list', true);
    return view(
      'offline',
      'neutral',
      s.pending > 0 ? `Offline · ${String(s.pending)} to sync` : 'Offline · deciding on this phone',
      true,
    );
  }
  if (s.download !== null && s.list === null)
    return view('downloading', 'info', `Downloading list ${groupDigits(s.download.done)} of ${groupDigits(s.download.total)}`);
  if (s.list === null) return view('online', 'success', 'Online · no offline list yet');
  const toSync = s.pending > 0 ? ` · ${String(s.pending)} to sync` : '';
  return view('online', 'success', `Online · list ${ago(s.list.syncedAt, nowMs)}${toSync}`);
}
```

`syncLine.ts`: delete `SyncLine`, `STALE_CLOCK_MS`, `clockWarning`, `syncLine`; keep `SyncStatus`, `EMPTY_SYNC`, `groupDigits`, `REJECTED`, `attentionLine` and helpers. In `syncLine.test.ts`, delete the `describe`/`it` blocks that call `syncLine(` (keep the rest). `grep -rn "syncLine(" src` must then only match nothing outside the deleted SyncBar (removed in Task 9).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/gate/domain && npx tsc --noEmit`
Expected: domain PASS; `tsc` reports `SyncBar.tsx` importing `syncLine`. Do **not** commit a failing `tsc`: in this task also delete `src/features/gate/ui/SyncBar.tsx` and `src/features/gate/ui/__tests__/SyncBar.test.tsx`, and in `ScannerScreen.tsx` remove the `SyncBar` import and its `<SyncBar …/>` element (Task 9 adds the replacement). In `ScannerScreen.test.tsx`, delete only the assertions that need the sync bar (`sync-bar` testID, "Refresh list"/"Sync now"/"Activity" links on the scanner). Then `npx tsc --noEmit && npx jest src/features/gate` passes. Add `src/features/gate/screens/__tests__/ScannerScreen.test.tsx` to this task's `git add`.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/statusPill.ts src/features/gate/domain/__tests__/statusPill.test.ts src/features/gate/domain/syncLine.ts src/features/gate/domain/__tests__/syncLine.test.ts src/features/gate/screens/ScannerScreen.tsx src/features/gate/screens/__tests__/ScannerScreen.test.tsx
git rm src/features/gate/ui/SyncBar.tsx src/features/gate/ui/__tests__/SyncBar.test.tsx
git commit -m "feat(gate): one status pill with a fixed priority replaces the sync line"
```

---

### Task 9: Scanner layout, gate status pill and camera permission prompt

**Files:**
- Create: `src/features/gate/ui/GateStatus.tsx`, `src/features/gate/ui/CameraPrompt.tsx`
- Modify: `src/features/gate/screens/ScannerScreen.tsx`, `src/app/(gate)/gate/[eventId].tsx`
- Test: `src/features/gate/screens/__tests__/ScannerScreen.test.tsx`, create `src/features/gate/ui/__tests__/GateStatus.test.tsx`

**Interfaces:**
- Consumes: `statusPill` (Task 8), `useSyncView`, kit `IconButton`, `ToggleButton`, `StatusPill`, `Illustration`, `Button`, `Text`, `color.inverse`, `density.gate`.
- Produces:
  - `GateStatus({ now: () => number, onOpen: (tab: ActivityTab) => void })` — renders `StatusPill` from `statusPill(status, now())`, re-evaluated every 30 s; wrapped in a `View` whose `accessibilityLiveRegion="polite"` content is a visually hidden `Text` keyed by `announceKey` (so it is re-mounted, and announced, only when the key changes).
  - `CameraPrompt({ state: 'ask' | 'denied', canAsk: boolean, onAllow: () => void, onOpenSettings: () => void, onEnterByHand: () => void })`.
  - ScannerScreen props unchanged except: `permission` `'unknown'` now shows `CameraPrompt state="ask"`; the route no longer requests on mount.

Layout (spec §4.3), top to bottom inside `SafeAreaView` with `backgroundColor: color.inverse`:
1. Top bar row (`paddingHorizontal: space.s4`, `gap: space.s3`): `IconButton icon={ArrowLeft} variant="inverse" accessibilityLabel="Change event" onPress={p.onChangeEvent}`; event title `Text variant="bodyStrong" tone="onInverse" numberOfLines={1} style={{ flex: 1 }}`; `ToggleButton icon={VolumeX} iconOn={Volume2} label="Sound" hideLabel variant="inverse" checked={!p.muted} onChange={p.onToggleMute}`.
2. Counter row (`paddingHorizontal: space.s5`, `flexDirection: 'row'`, `alignItems: 'flex-end'`, `justifyContent: 'space-between'`): `DoorCounter` (pressable → opens Recent) and `GateStatus`.
3. Camera area (`flex: 1`): camera + `Viewfinder` + hint `Text variant="body" tone="onInverse"` "Point at the ticket QR code" at the bottom of the area; or `CameraPrompt` when permission is `unknown`/`denied`; or a centred "Camera paused" label when granted but not focused; the `Checking` pill stays top-left.
4. Bottom controls row (`testID="scanner-controls"`, `flexDirection: 'row'`, `justifyContent: 'space-around'`, `paddingTop: space.s4`, `paddingBottom: Math.max(insets.bottom, space.s5)`): `ToggleButton icon={Flashlight} label="Torch" variant="inverse" size="lg" checked={torch}`, `IconButton icon={UserSearch} label="Find guest" accessibilityLabel="Find guest" variant="filled" size="lg"`, `IconButton icon={Keyboard} label="Enter code" accessibilityLabel="Enter code" variant="inverse" size="lg"`.

`DoorCounter` (replace the existing one): shows `numLg` count (`shown.admitted` or `—`), `Text variant="label" tone="onInverse"` "admitted", and when `shown.total > 0` a caption "of 1,240" (`groupDigits`); caption "offline" / "not updated" kept as before. It is a `Pressable` with `accessibilityRole="button"`, `accessibilityLabel={`${admitted} admitted${total ? ` of ${total}` : ''}${caption ? `, ${caption}` : ''}. Open recent admissions`}`, `onPress={() => setShowRecent(true)}`, `hitSlop={8}`.

`Viewfinder`: keep the structure; replace `CORNER`/`EDGE` literals with `const CORNER = space.s8; const EDGE = borderWidth.thick * 2;` and `borderColor: color.onInverse`.

- [ ] **Step 1: Write the failing tests**

`src/features/gate/ui/__tests__/GateStatus.test.tsx`:

```tsx
import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { EMPTY_SYNC } from '@/features/gate/domain/syncLine';
import { useSyncView } from '@/features/gate/state/syncView';
import { GateStatus } from '@/features/gate/ui/GateStatus';

const NOW = Date.parse('2026-10-08T18:00:00Z');

beforeEach(() => {
  useSyncView.getState().reset();
});

it('shows the most important state and opens Activity on its tab', async () => {
  useSyncView.getState().set({ ...EMPTY_SYNC, attention: 2 });
  const onOpen = jest.fn();
  await render(<GateStatus now={() => NOW} onOpen={onOpen} />);
  await fireEvent.press(screen.getByRole('button', { name: '2 need attention' }));
  expect(onOpen).toHaveBeenCalledWith('attention');
});

it('announces only when the state kind changes', async () => {
  useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 120_000 } });
  await render(<GateStatus now={() => NOW} onOpen={jest.fn()} />);
  const first = screen.getByTestId('gate-status-live');
  await act(() => {
    useSyncView.getState().set({ list: { count: 10, syncedAt: NOW - 180_000 } });
  });
  expect(screen.getByTestId('gate-status-live')).toBe(first);
  await act(() => {
    useSyncView.getState().set({ mode: 'offline' });
  });
  expect(screen.getByTestId('gate-status-live')).not.toBe(first);
});
```

In `ScannerScreen.test.tsx` (read it first; it renders `ScannerScreen` with a `base` props object):
- Delete assertions about `sync-bar`, the "Recent" control and "Refresh list"/"Activity" links on the scanner.
- Change the mute test to `getByRole('switch', { name: 'Sound' })` with `checked` = `!muted`.
- Change any door-counter assertion on `'— / —'` / `'3 / 10'` to the new label, e.g. `getByRole('button', { name: /3 admitted of 10/ })`.
- Add:

```tsx
it('permission unknown: explains first, asks only on Allow, and offers manual entry', async () => {
  const onRequestPermission = jest.fn();
  await render(<ScannerScreen {...base} permission="unknown" onRequestPermission={onRequestPermission} />);
  expect(screen.getByText('Allow camera to scan tickets')).toBeTruthy();
  expect(onRequestPermission).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Allow camera' }));
  expect(onRequestPermission).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Enter codes by hand' }));
  expect(screen.getByRole('header', { name: 'Enter code' })).toBeTruthy();
});

it('denied without a re-ask offers settings', async () => {
  const onOpenSettings = jest.fn();
  await render(<ScannerScreen {...base} permission="denied" canAskPermission={false} onOpenSettings={onOpenSettings} />);
  expect(screen.getByText('Camera is off for Bookhushly')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Open settings' }));
  expect(onOpenSettings).toHaveBeenCalledTimes(1);
});

it('the door counter opens recent admissions', async () => {
  await render(<ScannerScreen {...base} />);
  await fireEvent.press(screen.getByRole('button', { name: /admitted.*Open recent admissions/ }));
  expect(screen.getByRole('header', { name: 'Recent admissions' })).toBeTruthy();
});

it('three bottom controls, labels capped for large text', async () => {
  await render(<ScannerScreen {...base} />);
  for (const name of ['Find guest', 'Enter code']) expect(screen.getByRole('button', { name })).toBeTruthy();
  expect(screen.getByRole('switch', { name: 'Torch' })).toBeTruthy();
  expect(screen.getByText('Find guest').props.maxFontSizeMultiplier).toBeLessThanOrEqual(1.3);
});
```

(If the existing denied test expects "Camera access is off", update it to "Camera is off for Bookhushly".)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/gate/ui/__tests__/GateStatus.test.tsx src/features/gate/screens/__tests__/ScannerScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`src/features/gate/ui/GateStatus.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { View } from 'react-native';

import { statusPill } from '@/features/gate/domain/statusPill';
import type { ActivityTab } from '@/features/gate/offline/outboxStore';
import { useSyncView } from '@/features/gate/state/syncView';
import { StatusPill, Text } from '@/shared/ui';

type Props = { now: () => number; onOpen: (tab: ActivityTab) => void };

// Always visible on the scanner (FR-3.9). Re-renders on sync status and a 30 s tick only.
export function GateStatus({ now, onOpen }: Props) {
  const status = useSyncView((s) => s.status);
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => {
      setTick((n) => n + 1);
    }, 30_000);
    return () => {
      clearInterval(id);
    };
  }, []);
  const pill = statusPill(status, now());
  return (
    <View style={{ alignItems: 'flex-end' }}>
      <StatusPill
        tone={pill.tone}
        label={pill.text}
        onPress={() => {
          onOpen(pill.tab);
        }}
      />
      {/* Keyed by state, not text: a screen reader hears a change once, never the minute ticks. */}
      <View accessibilityLiveRegion="polite" style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }}>
        <Text key={pill.announceKey} testID="gate-status-live" variant="caption">
          {pill.text}
        </Text>
      </View>
    </View>
  );
}
```

`src/features/gate/ui/CameraPrompt.tsx`:

```tsx
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, Illustration, Text } from '@/shared/ui';

type Props = {
  state: 'ask' | 'denied';
  canAsk: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
  onEnterByHand: () => void;
};

// Shown before the OS prompt (spec §4.2), and again when access is off.
export function CameraPrompt({ state, canAsk, onAllow, onOpenSettings, onEnterByHand }: Props) {
  const ask = state === 'ask' || canAsk;
  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: space.s6, gap: space.s5 }}>
      <View style={{ alignItems: 'center' }}>
        <Illustration name="camera" size={128} />
      </View>
      <Text variant="titleLg" tone="onInverse" accessibilityRole="header">
        {state === 'ask' ? 'Allow camera to scan tickets' : 'Camera is off for Bookhushly'}
      </Text>
      <Text variant="body" tone="onInverse">
        The camera is only used to read ticket codes. Nothing is recorded.
      </Text>
      <Button
        label={ask ? 'Allow camera' : 'Open settings'}
        onInverse="light"
        onPress={ask ? onAllow : onOpenSettings}
      />
      <Button variant="secondary" onInverse="light" label="Enter codes by hand" onPress={onEnterByHand} />
    </View>
  );
}
```

`ScannerScreen.tsx`: apply the layout above. Keep every prop, state hook, `Overlay`, override flow, sheets and their wiring unchanged, except:
- remove the `Control` component and `ListChecks` import; remove the old top bar and the denied block;
- `const insets = useContext(SafeAreaInsetsContext) ?? { bottom: 0 };`
- camera area:

```tsx
      <View style={{ flex: 1 }}>
        {p.permission === 'granted' && p.focused ? (
          <>
            <ScannerCamera torch={torch} paused={/* unchanged expression */} onCode={onCode} />
            <Viewfinder />
            <View pointerEvents="none" style={{ position: 'absolute', bottom: space.s5, left: 0, right: 0, alignItems: 'center' }}>
              <Text variant="body" tone="onInverse">Point at the ticket QR code</Text>
            </View>
          </>
        ) : null}
        {p.permission === 'granted' && !p.focused ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text variant="body" tone="onInverse">Camera paused</Text>
          </View>
        ) : null}
        {p.permission !== 'granted' ? (
          <CameraPrompt
            state={p.permission === 'unknown' ? 'ask' : 'denied'}
            canAsk={p.canAskPermission}
            onAllow={p.onRequestPermission}
            onOpenSettings={p.onOpenSettings}
            onEnterByHand={() => {
              setEntering(true);
            }}
          />
        ) : null}
        <View style={{ position: 'absolute', top: space.s4, left: space.s4 }}>
          <Checking />
        </View>
      </View>
```

- `Checking` pill: `backgroundColor: color.surface`, text tone `textPrimary` (readable over the camera).
- `<GateStatus now={p.serverNow} onOpen={setActivityTab} />` in the counter row.

`[eventId].tsx`: delete the effect

```ts
  useEffect(() => {
    if (permission === 'unknown') request();
  }, [permission, request]);
```

and the `const { permission, request } = camera;` line if nothing else uses it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/gate && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/ui/GateStatus.tsx src/features/gate/ui/CameraPrompt.tsx src/features/gate/ui/__tests__/GateStatus.test.tsx src/features/gate/screens/ScannerScreen.tsx src/features/gate/screens/__tests__/ScannerScreen.test.tsx "src/app/(gate)/gate/[eventId].tsx"
git commit -m "feat(gate): dark full-screen scanner with door counter, status pill, three controls and camera permission prompt"
```

---

### Task 10: Enter code, Recent and PIN sheets on the kit

**Files:**
- Modify: `src/features/gate/ui/EnterCodeSheet.tsx`, `src/features/gate/ui/RecentSheet.tsx`, `src/features/gate/ui/PinSheet.tsx`
- Test: `src/features/gate/ui/__tests__/EnterCodeSheet.test.tsx`, `RecentSheet.test.tsx`, `PinSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `Input`, `PinField`, `Banner`, `ListRow`, `StatusPill`, `SectionHeader`, `EmptyState`, `Button`.
- Produces: same component names and props as today (no caller changes).

Rules:
- **EnterCodeSheet:** `<Sheet visible title="Enter code" onClose={onClose} scroll footer={<Button label="Check ticket" onPress={submit} />}>` with the `Input` inside; drop the separate Cancel button (Close in the header replaces it). The header test expects `header` "Enter code" — still true.
- **RecentSheet:** `<Sheet visible title="Recent admissions" onClose={onClose}>`; `recent === null` → `<Text tone="textMuted">Not loaded yet.</Text>`; empty → `<EmptyState icon={ListChecks} title="No admissions yet" />`; rows → `FlatList` of `ListRow title={item.ticket_type ?? 'Ticket'} subtitle={time(item.checked_in_at)} trailing={item.scanned_by_me ? <StatusPill tone="neutral" label="By me" /> : undefined}`. `time()` uses `toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })`.
- **PinSheet:** `<Sheet visible title={…unchanged} onClose={onClose} scroll footer={<Button label={checking ? 'Checking…' : 'Confirm'} loading={checking} onPress={() => void confirm()} disabled={!valid || locked} />}>`; replace the PIN `Input` with `<PinField label="PIN" value={pin} onChangeText={setPin} />`; Approver and Reason stay `Input` (Reason gets `hint={purpose === 'override' ? '3 to 200 characters' : undefined}`); the message renders as `<Banner tone={tone} message={text} live="assertive" />` where `tone` is `'neutral'` for `result === 'failed'` (transient), `'danger'` for `wrong`/`locked`, `'info'` for `unavailable`. Drop the separate Cancel button. Keep all state and `confirm()` logic byte-for-byte.

Note on `Button loading` + label: with `loading`, the button name stays `Checking…` (label passed is `Checking…`), so existing tests querying `Checking…` keep working; disabled now comes from `loading`.

- [ ] **Step 1: Update the tests first**

- `EnterCodeSheet.test.tsx` / `PinSheet.test.tsx` / `RecentSheet.test.tsx`: replace presses on `Cancel` with presses on `Close` (`getByRole('button', { name: 'Close' })`).
- `PinSheet.test.tsx` add:

```tsx
it('a transient check failure is neutral, a wrong PIN is danger', async () => {
  const check = jest.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce({ kind: 'wrong', triesLeft: 4 });
  await render(<PinSheet visible purpose="override" check={check} onApproved={jest.fn()} onClose={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('PIN'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Approver'), 'Ada');
  await fireEvent.changeText(screen.getByLabelText('Reason'), 'Phone died');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('Override isn’t available right now — try again')).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.neutral.bg });
  await fireEvent.changeText(screen.getByLabelText('PIN'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('Wrong PIN — 4 tries left')).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.danger.bg });
});
```

- `RecentSheet.test.tsx`: "By me" is now a pill — assert `getByText('By me')` still exists (unchanged query).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/gate/ui/__tests__/EnterCodeSheet.test.tsx src/features/gate/ui/__tests__/PinSheet.test.tsx src/features/gate/ui/__tests__/RecentSheet.test.tsx`
Expected: FAIL (no Close button yet / banner missing).

- [ ] **Step 3: Implement** the three sheets per the rules above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/gate && npx tsc --noEmit && npx expo lint`
Expected: PASS (FindGuestSheet nests PinSheet; its tests still pass).

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/ui/EnterCodeSheet.tsx src/features/gate/ui/RecentSheet.tsx src/features/gate/ui/PinSheet.tsx src/features/gate/ui/__tests__/EnterCodeSheet.test.tsx src/features/gate/ui/__tests__/RecentSheet.test.tsx src/features/gate/ui/__tests__/PinSheet.test.tsx
git commit -m "feat(gate): enter code, recent and PIN sheets on the shared sheet; PIN boxes; neutral transient PIN failures"
```

---

### Task 11: Find guest sheet on the kit

**Files:**
- Modify: `src/features/gate/ui/FindGuestSheet.tsx`
- Test: `src/features/gate/ui/__tests__/FindGuestSheet.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SearchField`, `SegmentedControl`, `ListRow`, `StatusPill`, `EmptyState`, `Banner`, `Button`, `Text`.
- Produces: same props; no caller change.

Rules (keep all state, effects, `start`/`run`/`fail`, generation guards and the nested `PinSheet` exactly as they are):
- Wrap in `<Sheet visible title={booking === null ? 'Find guest' : 'Booking'} onClose={onClose} closeDisabled={admitting !== null} testID="find-guest-sheet" onRequestClose={() => { if (admitting === null) onClose(); }}>`.
- Search view: `<SearchField label="Search guests" value={text} onChangeText={setText} placeholder="Name or last phone digits" autoCapitalize="words" />`, then a `SegmentedControl` with `value={filter}` (`const [filter, setFilter] = useState<'out' | 'in'>('out')`, reset to `'out'` in the close-reset block) and options `Not in (n)` / `In (n)` computed from `results` when it is an array (`count` undefined otherwise); the list shows `results.filter(g => filter === 'in' ? g.checkedInAt !== null : g.checkedInAt === null)`.
- Messages: `noList` → `<EmptyState illustration="search" title="No offline list on this phone yet" />`; `query === null` → `<Text tone="textMuted">Type a name or 2–4 phone digits</Text>`; searching → `<Text tone="textMuted">Searching…</Text>`; failed → `<Banner tone="neutral" message="Couldn’t search the list" />`; none → `<Text tone="textMuted">No one matches</Text>`. Keep the exact strings.
- Result rows: `ListRow leading={<Initials name={who(item)} />} title={who(item)} subtitle={ticketLabel(item)} trailing={<GuestStatus g={item} nowMs={Date.now()} />} accessibilityLabel={`${who(item)}, ${ticketLabel(item)}, ${statusOf(item)}`} onPress={…unchanged}`.
- `Initials`: a 40 round `wash` circle with up to two initials (`label` variant); for a masked phone (starts with a digit) show a `Phone` icon instead.
- `GuestStatus`: confirmed + in → `<StatusPill tone="success" label={`In · ${ago(parseIsoMs(g.checkedInAt) ?? nowMs, nowMs)}`} />` (`ago` from `@/features/gate/domain/ago`, `parseIsoMs` from `@/shared/lib/isoTime`); confirmed + not in → `<StatusPill tone="neutral" label="Not in" />`; not confirmed → `<StatusPill tone="warning" label={`Booking ${g.bookingStatus}`} />`.
- Booking view rows: `ListRow` with the same leading/title/subtitle and `note={<GuestStatus …/>}`; trailing is the existing `Admit` `Button` (unchanged props) when `canAdmit(item)`.
- Admit failure: `ADMIT_FAILED = 'Not recorded — try again'` shown as `<Banner tone="neutral" message={error} live="assertive" />`.
- Footer (booking view only): `<Button variant="secondary" label="Back to results" disabled={admitting !== null} onPress={…unchanged} />`. The separate bottom Close button is removed (header Close replaces it).

- [ ] **Step 1: Update tests first**

In `FindGuestSheet.test.tsx`:
- replace `'Couldn’t admit — try again'` with `'Not recorded — try again'`;
- presses on the bottom `Close` keep working (header Close has the same name);
- any assertion on the plain "In"/"Not in" status text: "Not in" is unchanged; "In" becomes "In · …" → use `getByText(/^In · /)`;
- add:

```tsx
it('splits results into Not in and In with counts', async () => {
  await renderSheet({ search: jest.fn().mockResolvedValue([guest({ id: 'a', checkedInAt: null }), guest({ id: 'b', checkedInAt: '2026-10-08T17:40:00Z' })]) });
  await fireEvent.changeText(screen.getByLabelText('Search guests'), 'ade');
  await act(() => { jest.advanceTimersByTime(250); });
  expect(await screen.findByRole('tab', { name: 'Not in (1)' })).toHaveAccessibilityState({ selected: true });
  await fireEvent.press(screen.getByRole('tab', { name: 'In (1)' }));
  expect(screen.getByText(/^In · /)).toBeTruthy();
});

it('while admitting, Close is disabled', async () => {
  // reuse the file's existing "admit in flight" setup (a never-resolving admit)
  expect(screen.getByRole('button', { name: 'Close' })).toHaveAccessibilityState({ disabled: true });
});
```

(`renderSheet` and `guest` are the file's existing helpers; if they are named differently, use those names. For the second test, put the assertion inside the existing in-flight admit test instead of a new `it`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/gate/ui/__tests__/FindGuestSheet.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** per the rules above.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/gate && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/ui/FindGuestSheet.tsx src/features/gate/ui/__tests__/FindGuestSheet.test.tsx
git commit -m "feat(gate): find guest with not-in/in tabs, initials, status pills and a plain not-recorded message"
```

---

### Task 12: Activity screen on the kit

**Files:**
- Modify: `src/features/gate/ui/ActivityScreen.tsx`, `src/features/gate/screens/ScannerScreen.tsx` (pass `onRefreshList`)
- Test: `src/features/gate/ui/__tests__/ActivityScreen.test.tsx`

**Interfaces:**
- Consumes: `Sheet`, `SegmentedControl`, `ListRow`, `SectionHeader`, `StatusPill`, `Banner`, `Button`, `Card`, `useSyncView`, `groupDigits`, `ago`.
- Produces: `ActivityScreen` props gain `onRefreshList: () => void` and `now: () => number`; ScannerScreen passes `p.onRefreshList` and `p.serverNow`.

Rules (keep `Page`, the generation refs, `load`/`loadMore`/`runExport` logic exactly):
- `<Sheet visible title="Activity" onClose={onClose} testID="activity-screen" right={<Button variant="ghost" label="Export" accessibilityLabel="Export CSV" loading={exporting} onPress={() => void runExport()} />} footer={pending > 0 ? <Button label="Sync now" onPress={onSyncNow} /> : undefined}>`.
- Top card: `Card` with `Text variant="bodyStrong"` "Offline list" and `Text variant="bodySm" tone="textSecondary"` `list === null ? 'Not downloaded yet' : `${groupDigits(list.count)} tickets · updated ${ago(list.syncedAt, now())}`` and a `Button variant="secondary" label="Refresh list" onPress={onRefreshList}` (`list` from `useSyncView((s) => s.status.list)`).
- Tabs: `SegmentedControl` with `To sync (pending)`, `Needs attention (attention)`, `Synced` (no count). Tab accessible names change from `To sync` to `To sync (3)`: update tests to use regexes `{ name: /^To sync/ }`.
- Rows grouped by local time hour: insert a `SectionHeader label={hh:00}` before the first row of each hour (compute in render from `rows`; use `FlatList` `data` of a union `{ kind: 'header'; key; label } | { kind: 'row'; item }`). Row: `ListRow leading={<StateIcon state={item.state} />} title={ticketLabel(item)} subtitle={[time, marker(item)].filter(Boolean).join(' · ')} trailing={<StatusPill tone={toneOf(item.state)} label={stateWord(item.state)} />} note={attentionLine(item) !== '' ? <Text variant="bodySm" tone="textSecondary">{attentionLine(item)}</Text> : undefined} accessibilityLabel={/* existing label string */}`.
  - `toneOf`: `pending|sending → 'neutral'`, `synced → 'success'`, `duplicate|suspect → 'warning'`, `rejected|blocked|error → 'danger'`.
  - `stateWord`: `pending|sending → 'To sync'`, `synced → 'Synced'`, `duplicate → 'Duplicate'`, `suspect → 'Check'`, `rejected → 'Rejected'`, `blocked → 'Not sent'`, `error → 'Not sent'`.
  - `StateIcon`: lucide `Clock` (to sync), `CircleCheck` (synced), `TriangleAlert` (attention states), size `sm`, tone matching.
  - The Lookup/Override marker is plain text in the subtitle (no violet).
- Errors: load failure → `<Banner tone="neutral" message={LOAD_FAILED} />`; load-more failure → `<Banner tone="neutral" message="Couldn’t load more — try again" />`; export failure → `<Banner tone="neutral" message={EXPORT_FAILED} live="assertive" />`.
- Empty per tab: `<Text tone="textMuted">{empty}</Text>` (strings unchanged).
- Remove the bottom Close/Sync now/Export row (header and footer replace them).

- [ ] **Step 1: Update tests first**

In `ActivityScreen.test.tsx`: tab queries → regex names; `Export CSV` press unchanged (accessible label kept); `Sync now` only exists when `pending > 0` → set `useSyncView` pending in tests that press it; `Close` unchanged. Add:

```tsx
it('shows the offline list card and refreshes it', async () => {
  useSyncView.getState().set({ list: { count: 1240, syncedAt: NOW - 120_000 } });
  const onRefreshList = jest.fn();
  await renderActivity({ onRefreshList, now: () => NOW });
  expect(screen.getByText('1,240 tickets · updated 2 min ago')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Refresh list' }));
  expect(onRefreshList).toHaveBeenCalledTimes(1);
});

it('lookup and override markers are not violet', async () => {
  await renderActivity({ load: jest.fn().mockResolvedValue([item({ mode: 'manual_lookup' })]) });
  const marker = await screen.findByText(/Lookup/);
  expect(marker).not.toHaveStyle({ color: color.linkText });
});
```

(`renderActivity`, `item`, `NOW` are the file's existing helpers/fixtures or thin new wrappers around its current render call.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/gate/ui/__tests__/ActivityScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement** per the rules; pass `onRefreshList={p.onRefreshList}` and `now={p.serverNow}` from `ScannerScreen`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features/gate && npx tsc --noEmit && npx expo lint`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/ui/ActivityScreen.tsx src/features/gate/ui/__tests__/ActivityScreen.test.tsx src/features/gate/screens/ScannerScreen.tsx
git commit -m "feat(gate): activity with export in the header, offline list card, grouped rows, state pills and sticky sync"
```

---

### Task 13: Event list, offline-list marks and the account sheet

**Files:**
- Modify: `src/features/gate/domain/eventList.ts`, `src/features/gate/offline/rosterStore.ts`, `src/features/gate/screens/EventListScreen.tsx`, `src/app/(gate)/gate/index.tsx`, `src/features/mode/screens/ModeSwitcher.tsx`
- Create: `src/features/gate/hooks/useOfflineLists.ts`, `src/features/gate/ui/AccountSheet.tsx`
- Test: `src/features/gate/domain/__tests__/eventList.test.ts`, `src/features/gate/offline/__tests__/rosterStore.test.ts`, `src/features/gate/screens/__tests__/EventListScreen.test.tsx`, create `src/features/gate/ui/__tests__/AccountSheet.test.tsx`

**Interfaces:**
- Consumes: `groupEvents`, `pickAutoOpen`, `eventLabel`, `hasGateDb`, `gateDb`, kit parts.
- Produces:
  - `eventStatus(e: ScannableEvent, nowMs: number): 'live' | 'today' | 'upcoming' | 'ended' | null` — `null` when `startsAt` is null/unparsable; `live` when `start ≤ now < start + 12 h`; `today` when start is later today (local date); `upcoming` when later; `ended` otherwise.
  - `dateTile(e: ScannableEvent): { month: string; day: string; weekday: string } | null` — `en-NG` short month (`'Oct'`), day number, short weekday; `null` for no/unparsable date.
  - `rosterStore.readyEventIds(): Promise<string[]>` — `SELECT event_id FROM roster_meta WHERE ready = 1`.
  - `useOfflineLists(userId: string | null): ReadonlySet<string>` — empty set until loaded; reads only when `hasGateDb(userId)`; failures yield an empty set (never throws, never blocks the list).
  - `EventListScreen` props: `identity: string` is removed and replaced by `onOpenAccount: () => void`; adds `offlineLists: ReadonlySet<string>`; `header?` and `onSignOut` are removed (they move to the account sheet).
  - `AccountSheet({ visible, email: string, modeSwitcher: ReactNode, onSignOut: () => void, onClose: () => void })` — the route passes `<ModeSwitcher …/>` (gate code must not import the mode feature; routes may).
  - `ModeSwitcher` keeps its props; renders a `radiogroup` of options with `accessibilityRole="radio"` and `checked`, each with a one-line description: Customer "Book and see your tickets", Gate staff "Scan tickets at the door", Front desk "Check in hotel guests".

- [ ] **Step 1: Write the failing tests**

`eventList.test.ts` add:

```ts
import { dateTile, eventStatus } from '@/features/gate/domain/eventList';

const ev = (startsAt: string | null) => ({ id: 'e1', title: 'Gala', startsAt, location: null });
const NOW = new Date(2026, 9, 8, 18, 0).getTime(); // local 18:00, 8 Oct 2026

describe('eventStatus', () => {
  it('live from start for 12 hours', () => {
    expect(eventStatus(ev(new Date(2026, 9, 8, 17, 0).toISOString()), NOW)).toBe('live');
  });
  it('later today', () => {
    expect(eventStatus(ev(new Date(2026, 9, 8, 21, 0).toISOString()), NOW)).toBe('today');
  });
  it('another day', () => {
    expect(eventStatus(ev(new Date(2026, 9, 10, 18, 0).toISOString()), NOW)).toBe('upcoming');
  });
  it('ended after 12 hours', () => {
    expect(eventStatus(ev(new Date(2026, 9, 7, 18, 0).toISOString()), NOW)).toBe('ended');
  });
  it('no or bad date has no status', () => {
    expect(eventStatus(ev(null), NOW)).toBeNull();
    expect(eventStatus(ev('not a date'), NOW)).toBeNull();
  });
});

describe('dateTile', () => {
  it('month, day and weekday', () => {
    expect(dateTile(ev(new Date(2026, 9, 10, 18, 0).toISOString()))).toEqual({ month: 'Oct', day: '10', weekday: 'Sat' });
  });
  it('null without a usable date', () => {
    expect(dateTile(ev(null))).toBeNull();
    expect(dateTile(ev('nope'))).toBeNull();
  });
});
```

`rosterStore.test.ts` add (uses the file's `setup`, `EV`, `MARK1`, `INFO`, `KEYS`, `row`):

```ts
  it('lists only events whose offline list finished downloading', async () => {
    const { store } = await setup();
    const EV2 = 'e0000000-0000-4000-8000-000000000002';
    await store.beginSync(EV, 'full', MARK1, INFO, KEYS);
    await store.writePage(EV, 'full', [row(1)], null);
    await store.finishSync(EV, 'full');
    await store.beginSync(EV2, 'full', MARK1, INFO, KEYS);
    expect(await store.readyEventIds()).toEqual([EV]);
  });
```

`AccountSheet.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AccountSheet } from '@/features/gate/ui/AccountSheet';

it('shows who is signed in, the mode switch slot, and signs out', async () => {
  const onSignOut = jest.fn();
  await render(
    <AccountSheet visible email="door@example.com" modeSwitcher={<Text>Mode switch</Text>} onSignOut={onSignOut} onClose={jest.fn()} />,
  );
  expect(screen.getByText('door@example.com')).toBeTruthy();
  expect(screen.getByText('Mode switch')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledTimes(1);
});
```

Create `src/features/mode/screens/__tests__/ModeSwitcher.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

it('is a radio group with the current mode checked', async () => {
  const onChoose = jest.fn();
  await render(<ModeSwitcher modes={['gate', 'customer']} current="gate" onChoose={onChoose} />);
  expect(screen.getByRole('radio', { name: /Gate staff/ })).toHaveAccessibilityState({ checked: true });
  await fireEvent.press(screen.getByRole('radio', { name: /Customer/ }));
  expect(onChoose).toHaveBeenCalledWith('customer');
});

it('renders nothing with only one mode', async () => {
  await render(<ModeSwitcher modes={['gate']} current="gate" onChoose={jest.fn()} />);
  expect(screen.queryByRole('radio')).toBeNull();
});
```

`EventListScreen.test.tsx` (read first): replace `identity`/`onSignOut`/`header` props in the shared props object with `onOpenAccount: jest.fn()` and `offlineLists: new Set<string>()`; remove sign-out assertions (moved to AccountSheet); replace the "Earlier (n)" button query with `getByRole('button', { name: 'Earlier (2)' })` (unchanged name) and add `toHaveAccessibilityState({ expanded: false })`; add:

```tsx
it('marks events with an offline list and a live pill', async () => {
  await render(<EventListScreen {...base} offlineLists={new Set(['e1'])} state={{ status: 'ready', events: [liveEvent('e1')] }} />);
  expect(screen.getByText('Offline list ready')).toBeTruthy();
  expect(screen.getByText('Live now')).toBeTruthy();
});

it('error says offline lists still work only when there is one', async () => {
  const { rerender } = await render(<EventListScreen {...base} state={{ status: 'error' }} />);
  expect(screen.queryByText('Offline lists on this phone still work')).toBeNull();
  await rerender(<EventListScreen {...base} offlineLists={new Set(['e1'])} state={{ status: 'error' }} />);
  expect(screen.getByText('Offline lists on this phone still work')).toBeTruthy();
});

it('account button opens the account sheet', async () => {
  const onOpenAccount = jest.fn();
  await render(<EventListScreen {...base} onOpenAccount={onOpenAccount} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  expect(onOpenAccount).toHaveBeenCalledTimes(1);
});
```

(`liveEvent(id)` returns `{ id, title: 'Gala', startsAt: new Date(base.nowMs - 3_600_000).toISOString(), location: 'Lagos' }`.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/features/gate/domain/__tests__/eventList.test.ts src/features/gate/offline/__tests__/rosterStore.test.ts src/features/gate/ui/__tests__/AccountSheet.test.tsx src/features/gate/screens/__tests__/EventListScreen.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`eventList.ts` add:

```ts
export type EventStatus = 'live' | 'today' | 'upcoming' | 'ended';

export function eventStatus(e: ScannableEvent, nowMs: number): EventStatus | null {
  const t = startOf(e);
  if (!Number.isFinite(t)) return null;
  if (t <= nowMs) return nowMs < t + STILL_ON_MS ? 'live' : 'ended';
  const a = new Date(t);
  const n = new Date(nowMs);
  const sameDay = a.getFullYear() === n.getFullYear() && a.getMonth() === n.getMonth() && a.getDate() === n.getDate();
  return sameDay ? 'today' : 'upcoming';
}

export function dateTile(e: ScannableEvent): { month: string; day: string; weekday: string } | null {
  const t = startOf(e);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return {
    month: d.toLocaleDateString('en-NG', { month: 'short' }),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-NG', { weekday: 'short' }),
  };
}
```

`rosterStore.ts`, inside the returned object next to `meta`:

```ts
    readyEventIds: async (): Promise<string[]> => {
      const rows = await db.all<{ event_id: string }>('SELECT event_id FROM roster_meta WHERE ready = 1 ORDER BY event_id', []);
      return rows.map((r) => r.event_id);
    },
```

(Check the `Sql` interface in `src/shared/db/sql.ts` for the multi-row method name — `all` or `select` — and use it.)

`src/features/gate/hooks/useOfflineLists.ts`:

```ts
import { useEffect, useState } from 'react';

import { gateDb, hasGateDb } from '@/features/gate/offline/gateDb';
import { captureException } from '@/shared/monitoring';

const NONE: ReadonlySet<string> = new Set();

// Which events have a finished offline list on this phone. Never blocks or fails the event list.
export function useOfflineLists(userId: string | null): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(NONE);
  useEffect(() => {
    if (userId === null) return;
    let live = true;
    void (async () => {
      try {
        if (!(await hasGateDb(userId))) return;
        const db = await gateDb(userId);
        const list = await db.roster.readyEventIds();
        if (live) setIds(new Set(list));
      } catch (e) {
        captureException(e);
      }
    })();
    return () => {
      live = false;
    };
  }, [userId]);
  return ids;
}
```

`ModeSwitcher.tsx` — replace the option rendering:

```tsx
const HINT: Record<Mode, string> = {
  customer: 'Book and see your tickets',
  gate: 'Scan tickets at the door',
  receptionist: 'Check in hotel guests',
};
// …
    <Stack gap="s3">
      <Text variant="label" tone="textSecondary">Mode</Text>
      <View accessibilityRole="radiogroup" style={{ gap: space.s3 }}>
        {modes.map((m) => {
          const checked = m === current;
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityLabel={`${LABEL[m]}, ${HINT[m]}`}
              accessibilityState={{ checked }}
              onPress={() => { onChoose(m); }}
              style={{
                minHeight: 64,
                paddingHorizontal: space.s4,
                paddingVertical: space.s3,
                justifyContent: 'center',
                borderRadius: radius.r3,
                borderWidth: checked ? 2 : 1,
                borderColor: checked ? color.actionFill : color.borderStrong,
                backgroundColor: color.surface,
              }}
            >
              <Text variant="bodyStrong">{LABEL[m]}</Text>
              <Text variant="bodySm" tone="textSecondary">{HINT[m]}</Text>
            </Pressable>
          );
        })}
      </View>
    </Stack>
```

(Selected state = violet border on a white card: violet here marks the selected control, which DESIGN_SYSTEM §4 allows; it is not a status.) Import `View` from `react-native` and `space` from `@/shared/theme` in `ModeSwitcher.tsx`. If other tests (customer home, front desk) query the mode options by `button`/`selected`, switch them to `radio`/`checked`.

`src/features/gate/ui/AccountSheet.tsx`:

```tsx
import { UserRound } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, Card, Icon, Sheet, Stack, Text } from '@/shared/ui';

type Props = {
  visible: boolean;
  email: string;
  /** The route passes <ModeSwitcher/>: gate code must not import the mode feature. */
  modeSwitcher: ReactNode;
  onSignOut: () => void;
  onClose: () => void;
};

// FR-1.9: whose session is active on a shared phone, plus mode switch and sign-out.
export function AccountSheet({ visible, email, modeSwitcher, onSignOut, onClose }: Props) {
  return (
    <Sheet visible={visible} title="Account" onClose={onClose} scroll footer={<Button variant="secondary" label="Sign out" onPress={onSignOut} />}>
      <Card>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s4 }}>
          <Icon as={UserRound} size="lg" tone="textSecondary" />
          <Stack gap="s1" flex={1}>
            <Text variant="label" tone="textMuted">Signed in as</Text>
            <Text variant="bodyStrong" numberOfLines={1}>{email}</Text>
          </Stack>
        </View>
      </Card>
      {modeSwitcher}
    </Sheet>
  );
}
```

`EventListScreen.tsx` — keep `autoOpened`/`pickAutoOpen` logic and `groupEvents`; replace the view:
- `Screen scroll bg="canvas" refreshControl={<RefreshControl refreshing={p.refreshing} onRefresh={p.onRefresh} />} header={<Header title="Events" right={<IconButton icon={UserRound} accessibilityLabel="Account" onPress={p.onOpenAccount} />} />}`.
- loading → `<SkeletonRows count={4} />`;
- error → `<ErrorState title="Couldn’t load your events" message="Check your connection." safeLine={p.offlineLists.size > 0 ? 'Offline lists on this phone still work' : undefined} onRetry={p.onRetry} />`;
- empty → `<EmptyState illustration="noEvents" title="No events assigned" message="Ask the organiser to add you as gate staff." action={{ label: 'Refresh', onPress: p.onRefresh }} />`;
- ready → upcoming rows, then `SectionHeader label="Earlier" count={g.earlier.length} expanded={showEarlier} onToggle={…}` and earlier rows when expanded.
- `EventRow`: `ListRow onPress={() => p.onOpen(e.id)} leading={<DateTile e={e} />} title={eventLabel(e)} subtitle={[timeOf(e), e.location].filter(Boolean).join(' · ')} note={<View style={{ flexDirection: 'row', gap: space.s2, flexWrap: 'wrap' }}>{pill}{p.offlineLists.has(e.id) ? <StatusPill tone="neutral" icon={Download} label="Offline list ready" /> : null}</View>} accessibilityLabel={`${eventLabel(e)}, ${when(e.startsAt)}`}`.
  - `pill`: `live → <StatusPill tone="success" label="Live now" />`, `today → info "Today"`, `upcoming → neutral "Upcoming"`, `ended`/`null` → none.
  - `DateTile`: 56×56 `surface` box with 1 px border, `r3`; `labelSm tone="linkText"` month, `title` day, `caption` weekday; `dateTile(e) === null` → `labelSm` "TBC".
  - `timeOf(e)`: `toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })` or `'Time to be confirmed'`.
  - `when()` switches its locale argument from `undefined` to `'en-NG'`.
- Remove the identity block and the Sign out button.

`src/app/(gate)/gate/index.tsx`: add `const [account, setAccount] = useState(false);` and `const offlineLists = useOfflineLists(userId);`; render

```tsx
    <>
      <EventListScreen
        state={last.loaded ? events.state : { status: 'loading' }}
        nowMs={nowMs}
        lastEventId={last.lastEventId}
        offlineLists={offlineLists}
        refreshing={events.refreshing}
        onRefresh={reload}
        onRetry={reload}
        onOpen={open}
        onOpenAccount={() => { setAccount(true); }}
      />
      <AccountSheet
        visible={account}
        email={state.status === 'signedIn' ? state.email : ''}
        modeSwitcher={<ModeSwitcher modes={modes} current="gate" onChoose={choose} />}
        onSignOut={() => { setAccount(false); signOut(); }}
        onClose={() => { setAccount(false); }}
      />
    </>
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/features && npx tsc --noEmit && npx expo lint`
Expected: PASS (customer/receptionist screens still render `ModeSwitcher` with the same props).

- [ ] **Step 5: Commit**

```bash
git add src/features/gate/domain/eventList.ts src/features/gate/domain/__tests__/eventList.test.ts src/features/gate/offline/rosterStore.ts src/features/gate/offline/__tests__/rosterStore.test.ts src/features/gate/hooks/useOfflineLists.ts src/features/gate/ui/AccountSheet.tsx src/features/gate/ui/__tests__/AccountSheet.test.tsx src/features/gate/screens/EventListScreen.tsx src/features/gate/screens/__tests__/EventListScreen.test.tsx src/features/mode/screens/ModeSwitcher.tsx src/features/mode/screens/__tests__/ModeSwitcher.test.tsx "src/app/(gate)/gate/index.tsx"
git commit -m "feat(gate): event list with date tiles, live and offline-list pills, skeleton and empty states; account sheet with mode switch and sign-out"
```

---

### Task 14: Docs, device checklist and full verification

**Files:**
- Modify: `docs/DESIGN_SYSTEM.md` (§8 kit list), `docs/device-tests/2026-10-08-gate-phone-checklist.md`
- No source changes unless verification finds a defect.

- [ ] **Step 1: Update DESIGN_SYSTEM §8**

Replace the `src/ui/` line in the §8 code block with:

```
src/shared/theme/  tokens.ts (private) · theme.ts (roles, textTone, surfaceTone) · type.ts · density.ts · elevation.ts · motion.ts · sizes.ts · index.ts
src/shared/ui/     Text · Box · Stack · Inline · Card · Icon · Money · Button · IconButton · ToggleButton · TextLink · Input · SearchField · PinField · Screen · Header · Sheet · ListRow · SectionHeader · SegmentedControl · Divider · StatusPill · Banner · EmptyState · ErrorState · Skeleton · Spinner · Illustration · SuccessMark · OutcomeScreen · DensityProvider · useMotionTier · PressableScale
```

and change the bullet "Set `userInterfaceStyle: "light"` … (currently still `automatic`)" to "`userInterfaceStyle: "light"` is set in `app.json`."

- [ ] **Step 2: Add the Redesign section to the checklist**

Insert before "## Tell me" in `docs/device-tests/2026-10-08-gate-phone-checklist.md`:

```markdown
## 8. Redesign (UI-A)

- [ ] **First scanner open** shows "Allow camera to scan tickets" before Android asks. "Enter codes by hand" opens Enter code without the camera.
- [ ] Deny the camera → "Camera is off for Bookhushly" with **Open settings**; allow it in Settings and return → the camera starts.
- [ ] **Event list:** date tiles, "Live now" / "Today" / "Upcoming" pills, "Offline list ready" on events you have opened before. Pull to refresh works. The account button shows your email, the mode switch (if you have two modes) and Sign out.
- [ ] **Scanner:** dark camera, door counter big enough to read at arm's length, one status pill under it. Tapping the counter opens Recent; tapping the pill opens Activity.
- [ ] **Outcomes:** green Admitted, amber Already used, red Refused (including "ask for the live ticket"), grey-violet Couldn't check. Titles are not in the serif font.
- [ ] **Sunlight:** outdoors, outcomes, the counter and the status pill are readable.
- [ ] **200 % text** (Settings → Display → Font size and Display size at max): the three bottom controls keep readable labels; outcome actions stay on screen; sheets scroll.
- [ ] **One hand:** Torch, Find guest and Enter code are reachable with the thumb holding the phone.
- [ ] **Reduce motion** (Settings → Accessibility → Remove animations): sheets appear without sliding; buttons don't scale.
- [ ] **Keyboard:** in the PIN sheet and Find guest, the keyboard never covers Confirm or the results.
- [ ] **10 minutes of scanning** on the new layout: no slowdown, no stuck sheet, battery drop similar to before.
```

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit && npx expo lint && npx jest`
Expected: all green. Record the test count in the report.

Run: `grep -rn "palette" src --include=*.ts --include=*.tsx | grep -v "src/shared/theme/"`
Expected: no output.

Run: `grep -rn "variant=\"display\"\|variant=\"displaySm\"" src/features/gate`
Expected: no output (no serif in gate screens).

- [ ] **Step 4: Commit**

```bash
git add docs/DESIGN_SYSTEM.md docs/device-tests/2026-10-08-gate-phone-checklist.md
git commit -m "docs(ui-a): kit list in the design system and a redesign section in the gate phone checklist"
```
