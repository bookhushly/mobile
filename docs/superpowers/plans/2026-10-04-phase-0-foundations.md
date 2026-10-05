# Phase 0 — Foundations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Commits:** the `Commit` steps are written for completeness, but per `CLAUDE.md` commit only once the owner has said to. Hooks block commits on `master`/`main`; Task 1 creates the feature branch.

**Goal:** A runnable, enforced foundation: tooling + CI, light-only design system, Supabase auth with encrypted session, typed API client, mode resolution and navigation shells, error/observability/version-gate basics — verified in a release build on the Moto G06.

**Architecture:** Thin Expo Router routes over `src/features/*` (auth, mode, gate, receptionist, customer) and `src/shared/*` (config, api, supabase, ui, theme, lib). Pure logic (errors, clock, API client core, encrypted store, mode resolution, routing, version compare, contrast) is injected-dependency TypeScript with no React/Expo imports and is unit-tested first. UI uses semantic theme roles and `src/shared/ui` primitives only.

**Tech Stack:** Expo SDK 57, RN 0.86, React 19.2, TS 6, Expo Router, `@supabase/supabase-js`, TanStack Query, Zustand, zod, `expo-secure-store` + AsyncStorage + `aes-js`, `expo-network`, `expo-application`, `react-native-svg` + `lucide-react-native`, `@expo-google-fonts/{radio-canada,source-serif-4}`, `@sentry/react-native`, `jest-expo` + RNTL, ESLint (flat) + Prettier, EAS.

**Spec:** `docs/superpowers/specs/2026-10-04-phase-0-foundations-design.md` (approved 2026-10-04). Also read: `CLAUDE.md`, `.claude/rules/*`, `docs/ENGINEERING_STANDARDS.md`, `docs/DESIGN_SYSTEM.md`, `docs/BACKEND_STATUS.md`.

## Global Constraints

- Expo SDK 57 / RN 0.86.3 / React 19.2.3 / TS ~6.0.3; add packages **only** with `npx expo install <pkg>` (dev deps: `npx expo install <pkg> -- --save-dev`); verify any Expo API against `https://docs.expo.dev/versions/v57.0.0/` before use (use the `expo-docs-researcher` agent when unsure).
- **Light UI only**; no `useColorScheme`, no dark-mode code. Primary `#7C3AED`, ink `#1A0D4D`, canvas `#F8F7FB`.
- Colours/spacing/radii/type only through theme tokens; **no raw hex, numeric spacing, or `fontWeight` outside `src/shared/theme` and `src/shared/ui`**. Fonts: Radio-Canada (UI), Source Serif 4 (display ≥32 px); weight = family name.
- No secrets in the app. Only `EXPO_PUBLIC_*` public values. Never read `../web/.env*` (approved exception already used: `.claude/hooks/copy-public-env.sh`).
- Production Supabase is live: **no destructive calls**, no test data left behind.
- Transient failures (429/503/timeout/network) are `retryable` and **never** a business refusal. Never fall back to "customer" when mode resolution fails.
- Routes in `src/app` are thin; features import only from `src/shared` (never another feature); `domain/` and `src/shared/lib` code imports nothing from `react`, `react-native`, `expo-*`.
- TS strict; no `any`, `@ts-ignore`, `as any`, `console.log` (use the logger); one component per file, named exports (default only for route files).
- Phase 0 contains no gate/receptionist/customer features, no sign-up, no forgot-password, no onboarding, no Lottie, no SQLite.
- Run `npx tsc --noEmit` and `npx expo lint` before declaring any task done; hooks must stay green.

## Review Focus

Failure modes the spec implies that no task would otherwise test (each has a pinned test in the owning task):

1. **Cold start offline with a stored session** — the user must stay signed in (never signed out by a refresh *network* failure). *(Task 12: auth reducer ignores non-`SIGNED_OUT` null-session noise; session survives.)*
2. **Reinstall with a leftover iOS Keychain key but no app data** — the stale key/session must be wiped, not used. *(Task 10.)*
3. **429 with `Retry-After`, 503, timeout, and a garbled/missing `Date` header** — mapped to retryable errors; clock offset unchanged by bad headers. *(Tasks 8–9.)*
4. **Repeated 401** — exactly one refresh + one retry, never a loop. *(Task 9.)*
5. **Staff account whose profile/role lookup fails** — retry screen, never customer; a user qualifying for several modes gets a list and a remembered default. *(Tasks 13–14.)*

---

## File Structure

```
.github/workflows/ci.yml
eas.json  eslint.config.js  .prettierrc  .env.example
jest.setup.ts (only if needed)
assets/fonts/*.ttf
src/app/_layout.tsx                          providers, splash hold, Stack.Protected layers
src/app/(auth)/_layout.tsx  (auth)/sign-in.tsx
src/app/(gate)/index.tsx  (receptionist)/index.tsx  (customer)/index.tsx
src/app/web-only.tsx  update-required.tsx  mode-error.tsx  __preview.tsx (dev only)
src/features/auth/{schemas,domain,api,hooks,screens}/…
src/features/mode/{domain,api,hooks,screens}/…
src/features/{gate,receptionist,customer}/screens/…Shell.tsx
src/shared/config/env.ts
src/shared/lib/{result.ts,errors.ts,logger.ts,version.ts,clock.ts}
src/shared/api/{client.ts,queryClient.ts}
src/shared/supabase/{encryptedStore.ts,client.ts}
src/shared/theme/{tokens.ts,theme.ts,type.ts,fonts.ts,density.ts,index.ts}
src/shared/ui/{Text,Box,Stack,Button,Input,Card,Icon,Money,Screen,ScreenError,ShellPlaceholder}.tsx
tests live in __tests__/ next to each unit
```

Delete in Task 6: template `src/components/*`, `src/constants/theme.ts`, `src/hooks/*`, `src/global.css`, `src/app/explore.tsx`, old `index.tsx`, unused template assets.

---

# Milestone 0.1 — Tooling and enforcement

### Task 1: Branch, test runner, lint, format

**Files:** Modify `package.json`, `tsconfig.json`; Create `eslint.config.js`, `.prettierrc`, `src/shared/lib/__tests__/smoke.test.ts`.

**Interfaces:** Produces `npm test`, `npm run lint`, `npm run typecheck`, alias `@/*` working in Jest.

- [ ] **Step 1: Create the feature branch**

```bash
git switch -c feat/phase-0-foundations
git status --short
```
Expected: on `feat/phase-0-foundations`; untracked docs/.claude files carry over (commit them in Step 9).

- [ ] **Step 2: Install tooling**

```bash
npx expo install jest-expo jest @types/jest -- --save-dev
npx expo install @testing-library/react-native -- --save-dev
npx expo install prettier eslint-config-prettier typescript-eslint -- --save-dev
npx expo lint
```
`npx expo lint` generates `eslint.config.js` and installs `eslint` + `eslint-config-expo` on first run. If `@testing-library/react-native` reports an unmet `test-renderer` peer, run `npx expo install test-renderer -- --save-dev`. Record any version surprises in the commit message.

- [ ] **Step 3: Configure scripts and Jest in `package.json`**

Add to `scripts`: `"typecheck": "tsc --noEmit"`, `"test": "jest"`, `"format": "prettier --write ."`, `"format:check": "prettier --check ."`. Add:

```json
"jest": {
  "preset": "jest-expo",
  "moduleNameMapper": { "^@/(.*)$": "<rootDir>/src/$1" },
  "testMatch": ["**/__tests__/**/*.test.ts?(x)"]
}
```

- [ ] **Step 3b: tsconfig** — in `compilerOptions` add `"noUncheckedIndexedAccess": true` and `"types": ["jest"]`. (Do **not** add `exactOptionalPropertyTypes` until TS 6 flags are confirmed.)

- [ ] **Step 4: `.prettierrc`**

```json
{ "singleQuote": true, "trailingComma": "all", "printWidth": 100 }
```

- [ ] **Step 5: Write `eslint.config.js`** (adapt only if `eslint-config-expo`'s export path differs; keep every rule):

```js
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier/flat');

const tsFiles = ['**/*.ts', '**/*.tsx'];
const featureNames = ['auth', 'mode', 'gate', 'receptionist', 'customer'];

const crossFeature = featureNames.map((f) => ({
  files: [`src/features/${f}/**`],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: featureNames.filter((o) => o !== f).map((o) => `@/features/${o}/*`),
        message: 'A feature must not import another feature; go through src/shared.',
      }],
    }],
  },
}));

module.exports = defineConfig([
  expoConfig,
  { ignores: ['dist/*', '.expo/*', 'node_modules/*', 'eslint.config.js'] },
  ...tseslint.configs.strictTypeChecked.map((c) => ({ ...c, files: tsFiles })),
  {
    files: tsFiles,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: __dirname } },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      'no-console': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'no-restricted-imports': ['error', {
        paths: [{ name: 'react-native', importNames: ['Text'], message: 'Use Text from @/shared/ui.' }],
      }],
    },
  },
  ...crossFeature,
  {
    files: ['src/shared/ui/**', 'src/shared/theme/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/features/**/domain/**', 'src/shared/lib/**'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['react', 'react-native', 'expo', 'expo-*', '@/shared/ui/*'],
          message: 'domain/ and shared/lib must stay pure (no React/RN/Expo).' }],
      }],
    },
  },
  {
    files: ['**/__tests__/**', '**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-console': 'off' },
  },
  prettier,
]);
```

- [ ] **Step 6: Write the smoke test** `src/shared/lib/__tests__/smoke.test.ts`

```ts
describe('toolchain', () => {
  it('resolves the @ alias', async () => {
    const mod = await import('@/shared/lib/result');
    expect(typeof mod.ok).toBe('function');
  });
});
```
(Fails until Task 7 creates `result.ts` — create that file now so the smoke test is meaningful:)

Create `src/shared/lib/result.ts`:

```ts
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
```

- [ ] **Step 7: Run everything**

```bash
npm test && npm run typecheck && npx expo lint && npx expo-doctor
```
Expected: smoke test PASS; typecheck/lint clean on the *new* files. The template files may produce lint/format findings — they are deleted in Task 6; if lint fails only on template files, note it and continue (do not "fix" template code).

- [ ] **Step 8: Prove the hooks fire** — create `src/shared/lib/zz.ts` containing `export const a: any = 1;`, confirm the editor hook rejects it (`check-source`), then delete the file.

- [ ] **Step 9: Commit** (after owner approval)

```bash
git add package.json package-lock.json tsconfig.json eslint.config.js .prettierrc src/shared/lib CLAUDE.md .claude docs
git commit -m "chore: tooling (jest-expo, eslint, prettier) + project docs and Claude setup"
```

### Task 2: CI, EAS, env template, app config

**Files:** Create `.github/workflows/ci.yml`, `eas.json`, `.env.example`; Modify `app.json`, `.gitignore`.

**Interfaces:** Produces EAS profiles `development | preview | production`; `.env.example` listing the four `EXPO_PUBLIC_*` names.

- [ ] **Step 1: `.env.example`**

```bash
# Public values only. Copy to .env.local (gitignored). Never put secrets here.
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_API_BASE_URL=https://www.bookhushly.com
EXPO_PUBLIC_SENTRY_DSN=
```

- [ ] **Step 2: `eas.json`**

```json
{
  "cli": { "version": ">= 16.0.0", "appVersionSource": "remote" },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "APP_ENV": "development" }
    },
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" },
      "env": { "APP_ENV": "preview" }
    },
    "production": {
      "autoIncrement": true,
      "env": { "APP_ENV": "production" }
    }
  }
}
```
Run `npx eas-cli@latest --version` and adjust `cli.version` to ≤ the installed version. (EXPO_PUBLIC_* values for cloud builds are set as EAS environment variables by the owner; local builds read `.env.local`.)

- [ ] **Step 3: `app.json`** — set `"name": "Bookhushly"`, `"slug": "bookhushly"`, `"scheme": "bookhushly"`, `"userInterfaceStyle": "light"`, `"android": { "package": "com.bookhushly.app", … }`, `"ios": { "bundleIdentifier": "com.bookhushly.app", … }`; keep existing `plugins` and `experiments` (typedRoutes, reactCompiler). **Ask the owner to confirm the package/bundle identifier before the first store build** (changing it later is costly); it is fine for dev builds.

- [ ] **Step 4: Dev client**

```bash
npx expo install expo-dev-client
```

- [ ] **Step 5: CI** `.github/workflows/ci.yml`

```yaml
name: ci
on: [pull_request, push]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - run: npm run typecheck
      - run: npx expo lint
      - run: npm test -- --ci
      - run: npx expo-doctor
```
Run `git remote -v`; if there is no remote, say so in the status and leave the workflow unexercised.

- [ ] **Step 6: Verify** — `npm run typecheck && npm test && npx expo-doctor`. Expected: green.

- [ ] **Step 7: Commit**

```bash
git add .github eas.json .env.example app.json package.json package-lock.json
git commit -m "chore: CI workflow, EAS profiles, env template, app identity"
```

---

# Milestone 0.2 — Theme, fonts, primitives

### Task 3: Design tokens + contrast test

**Files:** Create `src/shared/theme/{tokens.ts,theme.ts,type.ts,density.ts,index.ts}`, `src/shared/theme/__tests__/contrast.test.ts`.

**Interfaces:** Produces `palette`, `color` (semantic roles), `space`, `radius`, `typeVariants`, `density`, `contrastRatio(a,b)`.

- [ ] **Step 1: Write the failing test** `src/shared/theme/__tests__/contrast.test.ts`

```ts
import { color } from '@/shared/theme/theme';
import { contrastRatio } from '@/shared/theme/contrast';

const AA_TEXT = 4.5;
const AA_UI = 3;

describe('contrast', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#7C3AED', '#FFFFFF')).toBeCloseTo(5.7, 1);
  });

  const textPairs: [string, string][] = [
    [color.textPrimary, color.surface],
    [color.textPrimary, color.canvas],
    [color.textSecondary, color.surface],
    [color.textMuted, color.surface],
    [color.textMuted, color.canvas],
    [color.textMuted, color.wash],
    [color.onAction, color.actionFill],
    [color.linkText, color.surface],
    [color.outcome.admitted.fg, color.outcome.admitted.bg],
    [color.outcome.used.fg, color.outcome.used.bg],
    [color.outcome.refused.fg, color.outcome.refused.bg],
    [color.outcome.retry.fg, color.outcome.retry.bg],
    [color.status.success.fg, color.status.success.bg],
    [color.status.danger.fg, color.status.danger.bg],
    [color.status.warning.fg, color.status.warning.bg],
    [color.status.info.fg, color.status.info.bg],
  ];
  it.each(textPairs)('text %s on %s meets AA', (fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('input borders meet 3:1 on surface', () => {
    expect(contrastRatio(color.borderStrong, color.surface)).toBeGreaterThanOrEqual(AA_UI);
  });

  it('gate outcome fills reach 7:1 for sunlight legibility', () => {
    for (const o of [color.outcome.admitted, color.outcome.refused, color.outcome.retry]) {
      expect(contrastRatio(o.fg, o.bg)).toBeGreaterThanOrEqual(7);
    }
  });
});
```

- [ ] **Step 2: Run — expect FAIL** (`Cannot find module '@/shared/theme/theme'`): `npx jest src/shared/theme`.

- [ ] **Step 3: Implement** `src/shared/theme/contrast.ts`

```ts
function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}
function luminance(hex: string): number {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}
export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}
```

`src/shared/theme/tokens.ts`:

```ts
export const palette = {
  white: '#FFFFFF',
  canvas: '#F8F7FB',
  wash: '#F0EDF8',
  line: '#E0DBF0',
  lineStrong: '#857FA8',
  inkMuted: '#6B6987',
  inkSoft: '#4A4670',
  ink: '#1A0D4D',
  violet50: '#F4F1FF',
  violet100: '#EBE5FF',
  violet600: '#7C3AED',
  violet700: '#6D28D9',
  success: '#15803D', successWash: '#DCFCE7', successInk: '#14532D',
  warning: '#B45309', warningWash: '#FEF3C7', warningInk: '#78350F',
  danger: '#B91C1C', dangerWash: '#FEE2E2', dangerInk: '#7F1D1D',
  info: '#1D4ED8', infoWash: '#DBEAFE', infoInk: '#1E3A8A',
  gateAdmitted: '#166534',
  gateRefused: '#991B1B',
  gateUsed: '#B45309',
  gateRetry: '#4A4670',
} as const;

export const space = {
  s1: 2, s2: 4, s3: 8, s4: 12, s5: 16, s6: 20, s7: 24, s8: 32, s9: 40, s10: 48, s11: 64,
} as const;
export type SpaceKey = keyof typeof space;

export const radius = { r1: 4, r2: 8, r3: 12, r4: 16, rFull: 999 } as const;
export type RadiusKey = keyof typeof radius;
```

`src/shared/theme/theme.ts`:

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
  status: {
    success: { bg: palette.successWash, fg: palette.successInk, solid: palette.success },
    warning: { bg: palette.warningWash, fg: palette.warningInk, solid: palette.warning },
    danger: { bg: palette.dangerWash, fg: palette.dangerInk, solid: palette.danger },
    info: { bg: palette.infoWash, fg: palette.infoInk, solid: palette.info },
  },
  outcome: {
    admitted: { bg: palette.gateAdmitted, fg: palette.white },
    used: { bg: palette.gateUsed, fg: palette.white },
    refused: { bg: palette.gateRefused, fg: palette.white },
    retry: { bg: palette.gateRetry, fg: palette.white },
  },
} as const;
export type ColorRole = 'textPrimary' | 'textSecondary' | 'textMuted' | 'onAction' | 'linkText';
export type SurfaceRole = 'surface' | 'canvas' | 'wash' | 'actionFill' | 'selectedWash';
```

`src/shared/theme/type.ts`:

```ts
export type FontKind = 'sans' | 'serif';
export type VariantSpec = {
  font: FontKind;
  weight: 400 | 500 | 600;
  size: number;
  lineHeight: number;
  letterSpacing: number;
  maxScale: number;
};

export const typeVariants = {
  caption: { font: 'sans', weight: 400, size: 12, lineHeight: 16, letterSpacing: 0.2, maxScale: 1.6 },
  labelSm: { font: 'sans', weight: 600, size: 12, lineHeight: 16, letterSpacing: 0.2, maxScale: 1.6 },
  label: { font: 'sans', weight: 600, size: 14, lineHeight: 20, letterSpacing: 0, maxScale: 1.6 },
  bodySm: { font: 'sans', weight: 400, size: 14, lineHeight: 20, letterSpacing: 0, maxScale: 1.6 },
  body: { font: 'sans', weight: 400, size: 16, lineHeight: 24, letterSpacing: 0, maxScale: 1.6 },
  bodyStrong: { font: 'sans', weight: 600, size: 16, lineHeight: 24, letterSpacing: 0, maxScale: 1.6 },
  headline: { font: 'sans', weight: 600, size: 18, lineHeight: 28, letterSpacing: 0, maxScale: 1.3 },
  title: { font: 'sans', weight: 600, size: 20, lineHeight: 28, letterSpacing: -0.2, maxScale: 1.3 },
  titleLg: { font: 'sans', weight: 600, size: 24, lineHeight: 32, letterSpacing: -0.3, maxScale: 1.3 },
  displaySm: { font: 'serif', weight: 500, size: 32, lineHeight: 40, letterSpacing: -0.64, maxScale: 1.15 },
  display: { font: 'serif', weight: 500, size: 40, lineHeight: 48, letterSpacing: -1, maxScale: 1.15 },
  num: { font: 'sans', weight: 600, size: 20, lineHeight: 28, letterSpacing: 0, maxScale: 1.3 },
  numXl: { font: 'sans', weight: 600, size: 64, lineHeight: 72, letterSpacing: -1, maxScale: 1 },
} as const satisfies Record<string, VariantSpec>;
export type Variant = keyof typeof typeVariants;
```

`src/shared/theme/density.ts`:

```ts
export type DensityName = 'customer' | 'work' | 'gate';
export const density = {
  customer: { controlHeight: 48, rowMin: 56, targetGap: 12 },
  work: { controlHeight: 48, rowMin: 64, targetGap: 12 },
  gate: { controlHeight: 64, rowMin: 72, targetGap: 16 },
} as const satisfies Record<DensityName, { controlHeight: number; rowMin: number; targetGap: number }>;
```

`src/shared/theme/index.ts`:

```ts
export { palette, space, radius } from './tokens';
export type { SpaceKey, RadiusKey } from './tokens';
export { color } from './theme';
export type { ColorRole, SurfaceRole } from './theme';
export { typeVariants } from './type';
export type { Variant, FontKind } from './type';
export { density } from './density';
export type { DensityName } from './density';
export { contrastRatio } from './contrast';
```

- [ ] **Step 4: Run — expect PASS.** `npx jest src/shared/theme`. If a pair fails, the *token* is wrong (the doc's computed values are the contract) — adjust the token, not the threshold, and note it in DESIGN_SYSTEM.md.

- [ ] **Step 5: Verify + commit**

```bash
npm run typecheck && npx expo lint
git add src/shared/theme && git commit -m "feat(theme): design tokens, semantic roles, contrast test"
```

### Task 4: Fonts via the config plugin

**Files:** Create `assets/fonts/*.ttf`, `src/shared/theme/fonts.ts`, `src/shared/theme/__tests__/fonts.test.ts`; Modify `app.json`.

**Interfaces:** Produces `fontFamily(kind: FontKind, weight: 400|500|600): string`.

- [ ] **Step 1: Install**

```bash
npx expo install @expo-google-fonts/radio-canada @expo-google-fonts/source-serif-4
find node_modules/@expo-google-fonts/radio-canada node_modules/@expo-google-fonts/source-serif-4 -name '*.ttf' | grep -E 'RadioCanada_(400Regular|500Medium|600SemiBold)\.ttf|SourceSerif4_500Medium(_Italic)?\.ttf'
```
Expected: the 5 files listed. If file names differ, use the names printed (they are the source of truth) in all later steps.

- [ ] **Step 2: Copy the files into the repo and read their PostScript names**

```bash
mkdir -p assets/fonts
for f in $(find node_modules/@expo-google-fonts -name '*.ttf' | grep -E 'RadioCanada_(400Regular|500Medium|600SemiBold)\.ttf|SourceSerif4_500Medium(_Italic)?\.ttf'); do cp "$f" assets/fonts/; done
python3 - <<'EOF'
import glob
from fontTools.ttLib import TTFont
for p in sorted(glob.glob('assets/fonts/*.ttf')):
    f = TTFont(p); n = f['name']
    print(p.split('/')[-1], '| PostScript:', n.getDebugName(6), '| Family:', n.getDebugName(1))
EOF
```
If `fontTools` is missing: `pip3 install fonttools`. Record the printed PostScript names — iOS uses these.

- [ ] **Step 3: Register the plugin in `app.json`** (add to `plugins`; use exactly the file names from Step 2):

```json
["expo-font", {
  "fonts": [
    "./assets/fonts/RadioCanada_400Regular.ttf",
    "./assets/fonts/RadioCanada_500Medium.ttf",
    "./assets/fonts/RadioCanada_600SemiBold.ttf",
    "./assets/fonts/SourceSerif4_500Medium.ttf",
    "./assets/fonts/SourceSerif4_500Medium_Italic.ttf"
  ]
}]
```
Per Expo docs, with a plain `fonts` list the **Android family name is the file name without `.ttf`**, the **iOS family is the PostScript name**.

- [ ] **Step 4: Write the failing test** `src/shared/theme/__tests__/fonts.test.ts`

```ts
import { fontFamily } from '@/shared/theme/fonts';

describe('fontFamily', () => {
  it('returns a distinct family per weight for sans', () => {
    const set = new Set([400, 500, 600].map((w) => fontFamily('sans', w as 400 | 500 | 600)));
    expect(set.size).toBe(3);
  });
  it('serif only ships weight 500 and falls back to it', () => {
    expect(fontFamily('serif', 600)).toBe(fontFamily('serif', 500));
  });
});
```

- [ ] **Step 5: Implement** `src/shared/theme/fonts.ts` (iOS names below are the expected PostScript names — **replace them with the values printed in Step 2 if they differ**):

```ts
import { Platform } from 'react-native';
import type { FontKind } from './type';

type Weight = 400 | 500 | 600;

const android = {
  sans: { 400: 'RadioCanada_400Regular', 500: 'RadioCanada_500Medium', 600: 'RadioCanada_600SemiBold' },
  serif: { 400: 'SourceSerif4_500Medium', 500: 'SourceSerif4_500Medium', 600: 'SourceSerif4_500Medium' },
} as const;

const ios = {
  sans: { 400: 'RadioCanada-Regular', 500: 'RadioCanada-Medium', 600: 'RadioCanada-SemiBold' },
  serif: { 400: 'SourceSerif4-Medium', 500: 'SourceSerif4-Medium', 600: 'SourceSerif4-Medium' },
} as const;

export function fontFamily(kind: FontKind, weight: Weight): string {
  const table = Platform.OS === 'ios' ? ios : android;
  return table[kind][weight];
}
```

- [ ] **Step 6: Run** `npx jest src/shared/theme` → PASS; `npm run typecheck`.

- [ ] **Step 7: Commit** — `git add assets/fonts app.json package.json package-lock.json src/shared/theme && git commit -m "feat(theme): Radio-Canada + Source Serif 4 via expo-font config plugin"`.

*(On-device font verification happens in Task 6 once a dev build exists.)*

### Task 5: UI primitives

**Files:** Create `src/shared/ui/{Text,Box,Stack,Button,Input,Card,Icon,Money,Screen,ShellPlaceholder}.tsx`, `src/shared/ui/money.ts`, `src/shared/ui/index.ts`, tests `src/shared/ui/__tests__/{money.test.ts,Text.test.tsx,Button.test.tsx}`.

**Interfaces:** Consumes Task 3–4 exports. Produces: `Text({variant, color, tabular, align, numberOfLines, children, testID, style})`, `Box/Stack/Inline({gap,p,px,py,bg,radius,children,…})`, `Button({label,onPress,variant,disabled,loading,testID})`, `Input({label,error,…TextInputProps})`, `Card`, `Icon({as,size,color})`, `Money({amount})`, `formatNaira(amount:number): string`, `Screen({children, scroll?, density?})`, `ShellPlaceholder({title, subtitle, identity, onSignOut})`.

- [ ] **Step 1: Install deps**

```bash
npx expo install react-native-svg lucide-react-native
```
Check `npx expo-doctor`; if `lucide-react-native` shows an incompatibility warning, record it and stop to ask the owner (fallback: `react-native-svg` icons drawn by hand).

- [ ] **Step 2: Failing test for money** `src/shared/ui/__tests__/money.test.ts`

```ts
import { formatNaira } from '@/shared/ui/money';

describe('formatNaira', () => {
  it.each([
    [0, '₦0'],
    [999, '₦999'],
    [1000, '₦1,000'],
    [45000, '₦45,000'],
    [1234567, '₦1,234,567'],
    [1500.5, '₦1,500.50'],
    [-2500, '-₦2,500'],
  ])('formats %p as %p', (n, expected) => {
    expect(formatNaira(n)).toBe(expected);
  });
});
```

- [ ] **Step 3: Run → FAIL; implement** `src/shared/ui/money.ts`

```ts
export function formatNaira(amount: number): string {
  const negative = amount < 0;
  const abs = Math.abs(amount);
  const [whole = '0', frac] = abs.toFixed(Number.isInteger(abs) ? 0 : 2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}₦${grouped}${frac !== undefined ? `.${frac}` : ''}`;
}
```
Run → PASS. (Manual grouping avoids relying on Hermes `Intl` locale data for `en-NG`.)

- [ ] **Step 4: `Text.tsx`**

```tsx
import type { ReactNode } from 'react';
import { Text as RNText, type StyleProp, type TextStyle } from 'react-native';
import { color, typeVariants, type ColorRole, type Variant } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

type Props = {
  variant?: Variant;
  tone?: ColorRole;
  tabular?: boolean;
  align?: TextStyle['textAlign'];
  numberOfLines?: number;
  testID?: string;
  style?: StyleProp<TextStyle>;
  children: ReactNode;
};

export function Text({
  variant = 'body', tone = 'textPrimary', tabular, align, numberOfLines, testID, style, children,
}: Props) {
  const v = typeVariants[variant];
  return (
    <RNText
      testID={testID}
      numberOfLines={numberOfLines}
      maxFontSizeMultiplier={v.maxScale}
      style={[
        {
          fontFamily: fontFamily(v.font, v.weight),
          fontSize: v.size,
          lineHeight: v.lineHeight,
          letterSpacing: v.letterSpacing,
          color: color[tone],
          textAlign: align,
        },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        style,
      ]}
    >
      {children}
    </RNText>
  );
}
```

- [ ] **Step 5: `Box.tsx` + `Stack.tsx`**

`Box.tsx`:
```tsx
import type { ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';
import { color, radius, space, type RadiusKey, type SpaceKey, type SurfaceRole } from '@/shared/theme';

export type BoxProps = {
  p?: SpaceKey; px?: SpaceKey; py?: SpaceKey; gap?: SpaceKey;
  bg?: SurfaceRole; rounded?: RadiusKey; border?: boolean; flex?: number;
  testID?: string; children?: ReactNode; style?: ViewStyle;
};

export function Box({ p, px, py, gap, bg, rounded, border, flex, testID, children, style }: BoxProps) {
  return (
    <View
      testID={testID}
      style={[
        {
          padding: p ? space[p] : undefined,
          paddingHorizontal: px ? space[px] : undefined,
          paddingVertical: py ? space[py] : undefined,
          gap: gap ? space[gap] : undefined,
          backgroundColor: bg ? color[bg] : undefined,
          borderRadius: rounded ? radius[rounded] : undefined,
          borderWidth: border ? 1 : undefined,
          borderColor: border ? color.border : undefined,
          flex,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}
```
`Stack.tsx`:
```tsx
import { Box, type BoxProps } from './Box';

export function Stack(props: BoxProps) {
  return <Box {...props} style={{ flexDirection: 'column', ...props.style }} />;
}
export function Inline(props: BoxProps & { align?: 'center' | 'flex-start' | 'flex-end' }) {
  const { align = 'center', ...rest } = props;
  return <Box {...rest} style={{ flexDirection: 'row', alignItems: align, ...props.style }} />;
}
```

- [ ] **Step 6: `Button.tsx`**

```tsx
import { ActivityIndicator, Pressable } from 'react-native';
import { color, density, radius, space } from '@/shared/theme';
import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function Button({ label, onPress, variant = 'primary', disabled, loading, testID }: Props) {
  const inactive = disabled === true || loading === true;
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading === true }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: density.customer.controlHeight,
        paddingHorizontal: space.s5,
        borderRadius: radius.r3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary ? (pressed ? color.actionPressed : color.actionFill) : color.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: color.borderStrong,
        opacity: inactive ? 0.5 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={primary ? color.onAction : color.textPrimary} />
      ) : (
        <Text variant="bodyStrong" tone={primary ? 'onAction' : 'textPrimary'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
```

- [ ] **Step 7: `Input.tsx`, `Card.tsx`, `Icon.tsx`, `Money.tsx`, `Screen.tsx`, `ShellPlaceholder.tsx`**

`Input.tsx`:
```tsx
import { TextInput, type TextInputProps } from 'react-native';
import { color, density, radius, space, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string | undefined };

export function Input({ label, error, ...rest }: Props) {
  const v = typeVariants.body;
  return (
    <Stack gap="s2">
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.textMuted}
        {...rest}
        style={{
          minHeight: density.customer.controlHeight,
          paddingHorizontal: space.s4,
          borderRadius: radius.r3,
          borderWidth: 1,
          borderColor: error ? color.status.danger.solid : color.borderStrong,
          backgroundColor: color.surface,
          color: color.textPrimary,
          fontFamily: fontFamily(v.font, v.weight),
          fontSize: v.size,
        }}
      />
      {error ? <Text variant="bodySm" style={{ color: color.status.danger.solid }}>{error}</Text> : null}
    </Stack>
  );
}
```
`Card.tsx`:
```tsx
import type { ReactNode } from 'react';
import { Box } from './Box';

export function Card({ children }: { children: ReactNode }) {
  return <Box bg="surface" rounded="r3" border p="s5">{children}</Box>;
}
```
`Icon.tsx`:
```tsx
import type { LucideIcon } from 'lucide-react-native';

type Props = { as: LucideIcon; size?: 16 | 20 | 24 | 32; color: string };

export function Icon({ as: Glyph, size = 24, color }: Props) {
  return <Glyph size={size} color={color} strokeWidth={1.75} />;
}
```
`Money.tsx`:
```tsx
import type { Variant } from '@/shared/theme';
import { formatNaira } from './money';
import { Text } from './Text';

export function Money({ amount, variant = 'num' }: { amount: number; variant?: Variant }) {
  return <Text variant={variant} tabular>{formatNaira(amount)}</Text>;
}
```
`Screen.tsx`:
```tsx
import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { color, space } from '@/shared/theme';

export function Screen({ children, scroll }: { children: ReactNode; scroll?: boolean }) {
  const body = { paddingHorizontal: space.s5, paddingVertical: space.s5, gap: space.s5 };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: color.canvas }}>
      {scroll ? (
        <ScrollView contentContainerStyle={body}>{children}</ScrollView>
      ) : (
        <View style={[{ flex: 1 }, body]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
```
`ShellPlaceholder.tsx`:
```tsx
import { Button } from './Button';
import { Card } from './Card';
import { Screen } from './Screen';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = { title: string; subtitle: string; identity: string; onSignOut: () => void };

export function ShellPlaceholder({ title, subtitle, identity, onSignOut }: Props) {
  return (
    <Screen>
      <Stack gap="s3">
        <Text variant="titleLg">{title}</Text>
        <Text variant="body" tone="textSecondary">{subtitle}</Text>
      </Stack>
      <Card>
        <Stack gap="s2">
          <Text variant="label" tone="textMuted">Signed in as</Text>
          <Text variant="bodyStrong" testID="shell-identity">{identity}</Text>
        </Stack>
      </Card>
      <Button variant="secondary" label="Sign out" onPress={onSignOut} testID="shell-sign-out" />
    </Screen>
  );
}
```
`index.ts` re-exports every component and `formatNaira`.

- [ ] **Step 8: Component tests** — `Text.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from '@/shared/ui';

it('renders text with tabular numerals when requested', () => {
  render(<Text tabular testID="t">₦1,000</Text>);
  const node = screen.getByTestId('t');
  expect(node.props.style).toEqual(expect.arrayContaining([{ fontVariant: ['tabular-nums'] }]));
  expect(node.props.maxFontSizeMultiplier).toBe(1.6);
});
```
`Button.test.tsx`:
```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from '@/shared/ui';

it('calls onPress and exposes button role/label', () => {
  const onPress = jest.fn();
  render(<Button label="Sign in" onPress={onPress} />);
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
it('does not fire while loading', () => {
  const onPress = jest.fn();
  render(<Button label="Sign in" onPress={onPress} loading />);
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(onPress).not.toHaveBeenCalled();
});
```
Run `npx jest src/shared/ui` → PASS (money, Text, Button). If RNTL queries fail because of the `test-renderer` peer, fix per Task 1 Step 2.

- [ ] **Step 9: Verify + commit** — `npm run typecheck && npx expo lint && npm test`; `git add src/shared/ui package.json package-lock.json && git commit -m "feat(ui): primitives (Text, Box, Stack, Button, Input, Card, Icon, Money, Screen)"`.

### Task 6: Remove the template, preview route, first dev build on the phone

**Files:** Delete template files (see File Structure); Create `src/app/_layout.tsx` (temporary shell), `src/app/index.tsx`, `src/app/__preview.tsx`; Modify `app.json`.

- [ ] **Step 1: Delete template code**

```bash
git rm -r src/components src/constants src/hooks src/global.css src/app/explore.tsx
git rm -r assets/images/tabIcons assets/images/tutorial-web.png assets/images/react-logo*.png assets/images/expo-badge*.png assets/images/expo-logo.png assets/images/logo-glow.png
```
Keep: `icon.png`, `splash-icon.png`, android icon files, `favicon.png`, `assets/expo.icon`. (App icon/splash are placeholders until the owner supplies brand assets — note in status.) Remove `scripts/reset-project.js` and its `reset-project` script entry.

- [ ] **Step 2: Temporary root layout** `src/app/_layout.tsx`

```tsx
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
```
`src/app/index.tsx`: `import { Redirect } from 'expo-router'; export default function Index() { return <Redirect href="/__preview" />; }`

- [ ] **Step 3: `src/app/__preview.tsx`** — renders every `typeVariants` key, a Yoruba/Igbo + naira line (`"Ẹ kú àbọ̀ — ọ̀ṣọ́ ṣị ụ · ₦1,234,567"`), tabular figure columns (`Money` for `1111`, `8888`), the palette swatches via `Box bg=…`, a primary/secondary/loading `Button`, an `Input` with an error, and a gated Source Serif `display` line. Guard with `if (!__DEV__) return <Redirect href="/" />`. (Throwaway; deleted in Task 18.)

- [ ] **Step 4: Remove dark-mode leftovers** — `grep -rn "useColorScheme\|DarkTheme\|dark" src app.json` must return nothing; `app.json` has `"userInterfaceStyle": "light"`.

- [ ] **Step 5: Verify static checks** — `npm run typecheck && npx expo lint && npm test`.

- [ ] **Step 6: First dev build on the Moto G06**

```bash
adb devices   # enable USB debugging on the phone; expect the Moto G06 listed as "device"
npx expo run:android --device
```
(First run runs prebuild; `ios/` `android/` are generated and gitignored — never hand-edit.) If the local toolchain fails, fall back to `npx eas-cli@latest build --profile development --platform android` and install the APK.

- [ ] **Step 7: On-device check (owner, with Claude's checklist)** — the preview screen shows: Radio-Canada body text and Source Serif display with **no fallback flash on cold start**; `₦ ẹ ọ ṣ ị ụ` render correctly (`ǹ` may fall back — accepted, D7); `1111` and `8888` align in tabular columns; all weights distinct; light status bar. Record results (and a screenshot path) in `docs/superpowers/plans/…` status notes. **If font names are wrong on iOS/Android (system font shows), fix `fonts.ts` from the printed names and rebuild before continuing.**

- [ ] **Step 8: Commit** — `git add -A src app.json assets package.json package-lock.json scripts && git commit -m "feat: remove Expo template; preview route; first dev build"`.

---

# Milestone 0.3 — The slice

### Task 7: Errors, logger, env, version compare

**Files:** Create `src/shared/lib/{errors.ts,logger.ts,version.ts}`, `src/shared/config/env.ts`, tests `src/shared/lib/__tests__/{errors,version,logger}.test.ts`, `src/shared/config/__tests__/env.test.ts`.

**Interfaces:** Produces `ApiError` union, `isRetryable(e)`, `errorFromResponse(status, body, headers)`, `isVersionSupported(current,min)`, `createLogger(sink)`, `parseEnv(source)`.

- [ ] **Step 1: Failing test** `errors.test.ts`

```ts
import { errorFromResponse, isRetryable, type ApiError } from '@/shared/lib/errors';

const h = (o: Record<string, string> = {}) => ({ get: (k: string) => o[k.toLowerCase()] ?? null });

describe('errorFromResponse', () => {
  it('maps 401 to auth and 403 to forbidden', () => {
    expect(errorFromResponse(401, {}, h()).kind).toBe('auth');
    expect(errorFromResponse(403, { code: 'forbidden' }, h())).toEqual({ kind: 'forbidden', code: 'forbidden' });
  });
  it('maps 404/409 with server code', () => {
    expect(errorFromResponse(404, { code: 'not_found' }, h())).toEqual({ kind: 'notFound', code: 'not_found' });
    expect(errorFromResponse(409, { code: 'already_checked_in', checked_in_at: 'x' }, h())).toMatchObject({
      kind: 'conflict', code: 'already_checked_in',
    });
  });
  it('maps 429 with Retry-After seconds, tolerating junk', () => {
    expect(errorFromResponse(429, {}, h({ 'retry-after': '12' }))).toEqual({ kind: 'rateLimited', retryAfterSec: 12 });
    expect(errorFromResponse(429, {}, h({ 'retry-after': 'soon' }))).toEqual({ kind: 'rateLimited' });
    expect(errorFromResponse(429, {}, h())).toEqual({ kind: 'rateLimited' });
  });
  it('maps 5xx to unavailable and other codes to unknown', () => {
    expect(errorFromResponse(503, { code: 'lookup_failed' }, h())).toEqual({ kind: 'unavailable', status: 503, code: 'lookup_failed' });
    expect(errorFromResponse(418, null, h())).toEqual({ kind: 'unknown', status: 418 });
  });
});

describe('isRetryable', () => {
  const cases: [ApiError, boolean][] = [
    [{ kind: 'network' }, true],
    [{ kind: 'timeout' }, true],
    [{ kind: 'rateLimited' }, true],
    [{ kind: 'unavailable', status: 503 }, true],
    [{ kind: 'auth' }, false],
    [{ kind: 'forbidden' }, false],
    [{ kind: 'notFound' }, false],
    [{ kind: 'conflict', code: 'x' }, false],
    [{ kind: 'validation' }, false],
  ];
  it.each(cases)('%j -> %p', (e, expected) => expect(isRetryable(e)).toBe(expected));
});
```

- [ ] **Step 2: Run → FAIL; implement** `src/shared/lib/errors.ts`

```ts
export type ApiError =
  | { kind: 'network' }
  | { kind: 'timeout' }
  | { kind: 'auth' }
  | { kind: 'forbidden'; code?: string }
  | { kind: 'notFound'; code?: string }
  | { kind: 'conflict'; code: string; body?: unknown }
  | { kind: 'rateLimited'; retryAfterSec?: number }
  | { kind: 'unavailable'; status: number; code?: string }
  | { kind: 'validation' }
  | { kind: 'unknown'; status?: number };

type HeaderReader = { get(name: string): string | null };

function codeOf(body: unknown): string | undefined {
  if (typeof body === 'object' && body !== null && 'code' in body) {
    const c = (body as { code: unknown }).code;
    return typeof c === 'string' ? c : undefined;
  }
  return undefined;
}

export function errorFromResponse(status: number, body: unknown, headers: HeaderReader): ApiError {
  const code = codeOf(body);
  if (status === 401) return { kind: 'auth' };
  if (status === 403) return code ? { kind: 'forbidden', code } : { kind: 'forbidden' };
  if (status === 404) return code ? { kind: 'notFound', code } : { kind: 'notFound' };
  if (status === 409) return { kind: 'conflict', code: code ?? 'conflict', body };
  if (status === 429) {
    const raw = headers.get('retry-after');
    const n = raw === null ? NaN : Number(raw);
    return Number.isFinite(n) && n >= 0 ? { kind: 'rateLimited', retryAfterSec: n } : { kind: 'rateLimited' };
  }
  if (status >= 500) return code ? { kind: 'unavailable', status, code } : { kind: 'unavailable', status };
  return { kind: 'unknown', status };
}

export function isRetryable(e: ApiError): boolean {
  switch (e.kind) {
    case 'network':
    case 'timeout':
    case 'rateLimited':
    case 'unavailable':
      return true;
    case 'auth':
    case 'forbidden':
    case 'notFound':
    case 'conflict':
    case 'validation':
    case 'unknown':
      return false;
  }
}
```
Run → PASS.

- [ ] **Step 3: Version compare (test then code)** `version.test.ts`

```ts
import { isVersionSupported } from '@/shared/lib/version';

it.each([
  ['1.0.0', '1.0.0', true],
  ['1.2.0', '1.1.9', true],
  ['1.0.0', '1.0.1', false],
  ['2.0.0', '10.0.0', false],
  ['1.10.0', '1.9.0', true],
  ['1.0', '1.0.0', true],
  ['garbage', '1.0.0', true], // never block on an unreadable version
])('%s >= %s -> %p', (cur, min, expected) => {
  expect(isVersionSupported(cur, min)).toBe(expected);
});
```
`src/shared/lib/version.ts`:
```ts
function parts(v: string): number[] | null {
  const p = v.split('.').map((x) => Number(x));
  return p.length > 0 && p.every((n) => Number.isInteger(n) && n >= 0) ? p : null;
}
export function isVersionSupported(current: string, min: string): boolean {
  const c = parts(current);
  const m = parts(min);
  if (!c || !m) return true;
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const a = c[i] ?? 0;
    const b = m[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}
export const MIN_SUPPORTED_VERSION = '1.0.0';
```

- [ ] **Step 4: Logger (test then code)** `logger.test.ts`

```ts
import { createLogger } from '@/shared/lib/logger';

it('scrubs sensitive keys and drops debug in production', () => {
  const lines: { level: string; msg: string; data?: Record<string, unknown> }[] = [];
  const log = createLogger((l) => lines.push(l), { production: true });
  log.debug('hidden', { a: 1 });
  log.info('signed in', { email: 'a@b.c', ticket_id: 'abc', access_token: 'tok', ok: 1, nested: { phone: '0803' } });
  expect(lines).toHaveLength(1);
  expect(lines[0]?.data).toEqual({ email: '[redacted]', ticket_id: '[redacted]', access_token: '[redacted]', ok: 1, nested: { phone: '[redacted]' } });
});
```
`src/shared/lib/logger.ts`:
```ts
export type LogLine = { level: 'debug' | 'info' | 'warn' | 'error'; msg: string; data?: Record<string, unknown> };
type Sink = (line: LogLine) => void;

const SENSITIVE = /(token|password|secret|email|phone|ticket|code|authorization|session|key)/i;

function scrub(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(scrub);
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, SENSITIVE.test(k) ? '[redacted]' : scrub(v)]),
    );
  }
  return value;
}

export function createLogger(sink: Sink, opts: { production: boolean }) {
  const emit = (level: LogLine['level']) => (msg: string, data?: Record<string, unknown>) => {
    if (level === 'debug' && opts.production) return;
    sink(data ? { level, msg, data: scrub(data) as Record<string, unknown> } : { level, msg });
  };
  return { debug: emit('debug'), info: emit('info'), warn: emit('warn'), error: emit('error') };
}
```
Create the default instance in `src/shared/lib/log.ts`: `export const log = createLogger((l) => { if (__DEV__) console[l.level === 'debug' ? 'log' : l.level](l.msg, l.data ?? ''); }, { production: !__DEV__ });` — the `no-console` rule needs a one-line `// eslint-disable-next-line no-console` here only (this is the single sanctioned console user). Hooks forbid `console.log`: use `console.info` for debug level (`console[l.level === 'debug' ? 'info' : l.level]`).

- [ ] **Step 5: Env (test then code)** `env.test.ts`

```ts
import { parseEnv } from '@/shared/config/env';

const good = {
  EXPO_PUBLIC_SUPABASE_URL: 'https://x.supabase.co',
  EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon',
  EXPO_PUBLIC_API_BASE_URL: 'https://www.bookhushly.com',
};
it('parses valid env and strips trailing slash', () => {
  expect(parseEnv({ ...good, EXPO_PUBLIC_API_BASE_URL: 'https://www.bookhushly.com/' }).apiBaseUrl).toBe('https://www.bookhushly.com');
});
it('treats an empty sentry dsn as undefined', () => {
  expect(parseEnv({ ...good, EXPO_PUBLIC_SENTRY_DSN: '' }).sentryDsn).toBeUndefined();
});
it('throws a readable error listing the missing variable', () => {
  expect(() => parseEnv({ ...good, EXPO_PUBLIC_SUPABASE_URL: undefined })).toThrow(/EXPO_PUBLIC_SUPABASE_URL/);
});
```
Install zod: `npx expo install zod`. `src/shared/config/env.ts`:
```ts
import { z } from 'zod';

const schema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z.string().url(),
  EXPO_PUBLIC_SUPABASE_ANON_KEY: z.string().min(10),
  EXPO_PUBLIC_API_BASE_URL: z.string().url(),
  EXPO_PUBLIC_SENTRY_DSN: z.string().optional(),
});

export type Env = {
  supabaseUrl: string;
  supabaseAnonKey: string;
  apiBaseUrl: string;
  sentryDsn: string | undefined;
};

export function parseEnv(source: Record<string, string | undefined>): Env {
  const r = schema.safeParse(source);
  if (!r.success) {
    const names = r.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Invalid or missing environment variables: ${names}`);
  }
  const d = r.data;
  return {
    supabaseUrl: d.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: d.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    apiBaseUrl: d.EXPO_PUBLIC_API_BASE_URL.replace(/\/+$/, ''),
    sentryDsn: d.EXPO_PUBLIC_SENTRY_DSN ? d.EXPO_PUBLIC_SENTRY_DSN : undefined,
  };
}

// Static dot-access only: Expo inlines process.env.EXPO_PUBLIC_X at build time.
export const env: Env = parseEnv({
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_SENTRY_DSN: process.env.EXPO_PUBLIC_SENTRY_DSN,
});
```
Because `env` is evaluated at import, tests import `parseEnv` only via a module that would also run the top-level `env`. To keep tests hermetic add `jest.setup.ts` exporting env defaults: in `package.json` jest config add `"setupFiles": ["<rootDir>/jest.setup.ts"]` and create `jest.setup.ts`:
```ts
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key-1234567890';
process.env.EXPO_PUBLIC_API_BASE_URL = 'https://api.test';
```

- [ ] **Step 6: Run all + commit** — `npm test && npm run typecheck && npx expo lint`; `git add src jest.setup.ts package.json package-lock.json && git commit -m "feat(core): error taxonomy, logger, env parsing, version compare"`.

### Task 8: Server clock offset

**Files:** Create `src/shared/lib/clock.ts`, `src/shared/lib/__tests__/clock.test.ts`.

**Interfaces:** Produces `createClock({ storage, now })` → `{ recordServerDate(header: string | null): Promise<void>; offsetMs(): number; serverNow(): number; load(): Promise<void> }` and `type KeyValue = { get(k:string):Promise<string|null>; set(k:string,v:string):Promise<void>; delete(k:string):Promise<void> }` (exported from `src/shared/lib/kv.ts`).

- [ ] **Step 1: `src/shared/lib/kv.ts`**

```ts
export type KeyValue = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
};

export function memoryKv(): KeyValue & { dump(): Record<string, string> } {
  const m = new Map<string, string>();
  return {
    get: (k) => Promise.resolve(m.get(k) ?? null),
    set: (k, v) => { m.set(k, v); return Promise.resolve(); },
    delete: (k) => { m.delete(k); return Promise.resolve(); },
    dump: () => Object.fromEntries(m),
  };
}
```

- [ ] **Step 2: Failing test** `clock.test.ts`

```ts
import { createClock } from '@/shared/lib/clock';
import { memoryKv } from '@/shared/lib/kv';

const DEVICE_NOW = Date.parse('2026-10-04T12:00:00Z');

describe('clock', () => {
  it('records the offset from a valid Date header and persists it', async () => {
    const kv = memoryKv();
    const clock = createClock({ storage: kv, now: () => DEVICE_NOW });
    await clock.recordServerDate('Sun, 04 Oct 2026 12:05:00 GMT');
    expect(clock.offsetMs()).toBe(5 * 60 * 1000);
    expect(clock.serverNow()).toBe(DEVICE_NOW + 5 * 60 * 1000);

    const reloaded = createClock({ storage: kv, now: () => DEVICE_NOW });
    await reloaded.load();
    expect(reloaded.offsetMs()).toBe(5 * 60 * 1000);
  });

  it('ignores a missing or garbled header and keeps the previous offset', async () => {
    const clock = createClock({ storage: memoryKv(), now: () => DEVICE_NOW });
    await clock.recordServerDate('Sun, 04 Oct 2026 12:00:30 GMT');
    await clock.recordServerDate(null);
    await clock.recordServerDate('not a date');
    expect(clock.offsetMs()).toBe(30_000);
  });

  it('ignores an absurd offset (>1 day) rather than trusting it', async () => {
    const clock = createClock({ storage: memoryKv(), now: () => DEVICE_NOW });
    await clock.recordServerDate('Sun, 05 Oct 2027 12:00:00 GMT');
    expect(clock.offsetMs()).toBe(0);
  });
});
```

- [ ] **Step 3: Run → FAIL; implement** `src/shared/lib/clock.ts`

```ts
import type { KeyValue } from './kv';

const KEY = 'bh.clock.offset';
const MAX_ABS_OFFSET_MS = 24 * 60 * 60 * 1000;

export function createClock(deps: { storage: KeyValue; now: () => number }) {
  let offset = 0;
  return {
    async load(): Promise<void> {
      const raw = await deps.storage.get(KEY);
      const n = raw === null ? NaN : Number(raw);
      if (Number.isFinite(n)) offset = n;
    },
    async recordServerDate(header: string | null): Promise<void> {
      if (header === null) return;
      const server = Date.parse(header);
      if (!Number.isFinite(server)) return;
      const next = server - deps.now();
      if (Math.abs(next) > MAX_ABS_OFFSET_MS) return;
      offset = next;
      await deps.storage.set(KEY, String(next));
    },
    offsetMs: () => offset,
    serverNow: () => deps.now() + offset,
  };
}
export type Clock = ReturnType<typeof createClock>;
```
Note: an HTTP `Date` header has 1 s resolution; Phase 2 treats the offset as ±1 s accurate.

- [ ] **Step 4: Run → PASS; commit** — `git add src/shared/lib && git commit -m "feat(core): persisted server clock offset"`.

### Task 9: API client

**Files:** Create `src/shared/api/client.ts`, `src/shared/api/__tests__/client.test.ts`.

**Interfaces:** Consumes `Result`, `ApiError`, `errorFromResponse`, `isRetryable`, `Clock`. Produces:

```ts
createApiClient(deps: {
  baseUrl: string;
  fetchFn: typeof fetch;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<string | null>;  // returns new access token or null
  clock: Pick<Clock, 'recordServerDate'>;
  appVersion: string; platform: string;
  timeoutMs?: number; maxRetries?: number;
  sleep?: (ms: number) => Promise<void>; random?: () => number;
}): { request<T>(path: string, opts: RequestOptions<T>): Promise<Result<T, ApiError>> }
type RequestOptions<T> = { method?: 'GET'|'POST'|'PATCH'|'DELETE'; body?: unknown; schema: z.ZodType<T>; idempotent?: boolean; signal?: AbortSignal };
```

- [ ] **Step 1: Failing tests** `client.test.ts`

```ts
import { z } from 'zod';
import { createApiClient } from '@/shared/api/client';

type Call = { url: string; init: RequestInit };
function res(status: number, body: unknown, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}
function make(responses: (Response | Error)[], over: Partial<Parameters<typeof createApiClient>[0]> = {}) {
  const calls: Call[] = [];
  const dates: (string | null)[] = [];
  const queue = [...responses];
  const fetchFn = jest.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = queue.shift();
    if (!next) throw new Error('no more responses');
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  }) as unknown as typeof fetch;
  const client = createApiClient({
    baseUrl: 'https://api.test',
    fetchFn,
    getAccessToken: () => Promise.resolve('tok1'),
    refreshSession: () => Promise.resolve('tok2'),
    clock: { recordServerDate: (d) => { dates.push(d); return Promise.resolve(); } },
    appVersion: '1.0.0 (7)',
    platform: 'android',
    sleep: () => Promise.resolve(),
    random: () => 0,
    ...over,
  });
  return { client, calls, dates, fetchFn };
}
const schema = z.object({ ok: z.boolean() });

describe('api client', () => {
  it('sends bearer + app headers and records the Date header', async () => {
    const { client, calls, dates } = make([res(200, { ok: true }, { date: 'Sun, 04 Oct 2026 12:00:00 GMT' })]);
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: true, value: { ok: true } });
    const h = calls[0]?.init.headers as Record<string, string>;
    expect(h['Authorization']).toBe('Bearer tok1');
    expect(h['X-App-Version']).toBe('1.0.0 (7)');
    expect(h['X-Platform']).toBe('android');
    expect(calls[0]?.url).toBe('https://api.test/api/x');
    expect(dates).toEqual(['Sun, 04 Oct 2026 12:00:00 GMT']);
  });

  it('refreshes once on 401 then retries once; a second 401 is an auth error (no loop)', async () => {
    const { client, calls } = make([res(401, {}), res(401, {})]);
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: false, error: { kind: 'auth' } });
    expect(calls).toHaveLength(2);
    expect((calls[1]?.init.headers as Record<string, string>)['Authorization']).toBe('Bearer tok2');
  });

  it('succeeds when the retry after refresh works', async () => {
    const { client } = make([res(401, {}), res(200, { ok: true })]);
    expect(await client.request('/api/x', { schema })).toEqual({ ok: true, value: { ok: true } });
  });

  it('returns auth when there is no token and refresh fails', async () => {
    const { client } = make([res(401, {})], { refreshSession: () => Promise.resolve(null) });
    expect(await client.request('/api/x', { schema })).toEqual({ ok: false, error: { kind: 'auth' } });
  });

  it('retries 503 on GET up to maxRetries then returns unavailable', async () => {
    const { client, fetchFn } = make([res(503, {}), res(503, {}), res(503, {})], { maxRetries: 2 });
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: false, error: { kind: 'unavailable', status: 503 } });
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('never auto-retries 429 and surfaces Retry-After', async () => {
    const { client, fetchFn } = make([res(429, {}, { 'retry-after': '30' })]);
    const r = await client.request('/api/x', { schema });
    expect(r).toEqual({ ok: false, error: { kind: 'rateLimited', retryAfterSec: 30 } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('does not retry a non-idempotent POST on network error', async () => {
    const { client, fetchFn } = make([new TypeError('Network request failed')]);
    const r = await client.request('/api/x', { method: 'POST', body: {}, schema });
    expect(r).toEqual({ ok: false, error: { kind: 'network' } });
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('retries a network error on GET', async () => {
    const { client, fetchFn } = make([new TypeError('Network request failed'), res(200, { ok: true })]);
    expect(await client.request('/api/x', { schema })).toEqual({ ok: true, value: { ok: true } });
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('maps an abort/timeout to timeout', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' });
    const { client } = make([abort], { maxRetries: 0 });
    expect(await client.request('/api/x', { schema })).toEqual({ ok: false, error: { kind: 'timeout' } });
  });

  it('turns a body that fails the schema into validation, not a crash', async () => {
    const { client } = make([res(200, { nope: 1 })]);
    expect(await client.request('/api/x', { schema })).toEqual({ ok: false, error: { kind: 'validation' } });
  });

  it('maps a 409 with a server code to conflict', async () => {
    const { client } = make([res(409, { code: 'already_checked_in' })]);
    const r = await client.request('/api/x', { method: 'POST', body: {}, schema });
    expect(r).toMatchObject({ ok: false, error: { kind: 'conflict', code: 'already_checked_in' } });
  });
});
```

- [ ] **Step 2: Run → FAIL; implement** `src/shared/api/client.ts`

```ts
import type { z } from 'zod';
import type { Clock } from '@/shared/lib/clock';
import { errorFromResponse, isRetryable, type ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';
export type RequestOptions<T> = {
  method?: Method;
  body?: unknown;
  schema: z.ZodType<T>;
  idempotent?: boolean;
  signal?: AbortSignal;
};

type Deps = {
  baseUrl: string;
  fetchFn: typeof fetch;
  getAccessToken: () => Promise<string | null>;
  refreshSession: () => Promise<string | null>;
  clock: Pick<Clock, 'recordServerDate'>;
  appVersion: string;
  platform: string;
  timeoutMs?: number;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export function createApiClient(deps: Deps) {
  const timeoutMs = deps.timeoutMs ?? 15_000;
  const maxRetries = deps.maxRetries ?? 2;
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const random = deps.random ?? Math.random;

  async function once(
    path: string, method: Method, body: unknown, token: string | null, outerSignal?: AbortSignal,
  ): Promise<Result<Response, ApiError>> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    outerSignal?.addEventListener('abort', () => controller.abort());
    try {
      const headers: Record<string, string> = {
        Accept: 'application/json',
        'X-App-Version': deps.appVersion,
        'X-Platform': deps.platform,
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const init: RequestInit = { method, headers, signal: controller.signal };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await deps.fetchFn(`${deps.baseUrl}${path}`, init);
      await deps.clock.recordServerDate(res.headers.get('date'));
      return ok(res);
    } catch (e) {
      const aborted = e instanceof Error && e.name === 'AbortError';
      return err(aborted ? { kind: 'timeout' } : { kind: 'network' });
    } finally {
      clearTimeout(timer);
    }
  }

  async function readBody(res: Response): Promise<unknown> {
    try {
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  }

  async function request<T>(path: string, opts: RequestOptions<T>): Promise<Result<T, ApiError>> {
    const method = opts.method ?? 'GET';
    const canRetry = method === 'GET' || opts.idempotent === true;
    let token = await deps.getAccessToken();
    let refreshed = false;
    let attempt = 0;

    for (;;) {
      const sent = await once(path, method, opts.body, token, opts.signal);
      let failure: ApiError;
      if (!sent.ok) {
        failure = sent.error;
      } else {
        const res = sent.value;
        if (res.ok) {
          const parsed = opts.schema.safeParse(await readBody(res));
          return parsed.success ? ok(parsed.data) : err({ kind: 'validation' });
        }
        if (res.status === 401 && !refreshed) {
          refreshed = true;
          const next = await deps.refreshSession();
          if (next === null) return err({ kind: 'auth' });
          token = next;
          continue;
        }
        failure = errorFromResponse(res.status, await readBody(res), res.headers);
      }
      const autoRetry =
        isRetryable(failure) && failure.kind !== 'rateLimited' && canRetry && attempt < maxRetries;
      if (!autoRetry) return err(failure);
      attempt += 1;
      await sleep(400 * attempt + Math.floor(random() * 200));
    }
  }

  return { request };
}
export type ApiClient = ReturnType<typeof createApiClient>;
```
Note: `Response` and `AbortController` exist in Jest's `jest-expo` environment (Node 18+/RN polyfills). If `Response` is undefined in the test runtime, add `import 'whatwg-fetch'`-free fallback: `global.Response` via `undici` is not needed on Node 22; verify by running the tests.

- [ ] **Step 3: Run → PASS** (`npx jest src/shared/api`); `npm run typecheck && npx expo lint`.

- [ ] **Step 4: Commit** — `git add src/shared/api && git commit -m "feat(api): typed client with retry, refresh, clock, taxonomy"`.

### Task 10: Encrypted session store

**Files:** Create `src/shared/supabase/encryptedStore.ts`, `src/shared/supabase/__tests__/encryptedStore.test.ts`.

**Interfaces:** Consumes `KeyValue`. Produces `createEncryptedStore(deps: { secure: KeyValue; plain: KeyValue; randomBytes: (n:number)=>Uint8Array; storageKey: string }): { getItem(k:string):Promise<string|null>; setItem(k:string,v:string):Promise<void>; removeItem(k:string):Promise<void> }` (the Supabase `storage` shape).

- [ ] **Step 1: Install**

```bash
npx expo install expo-secure-store @react-native-async-storage/async-storage aes-js react-native-get-random-values react-native-url-polyfill
npx expo install @types/aes-js -- --save-dev
```
Record the resolved versions. If `aes-js` misbehaves under Hermes in Task 14's device check, the spec's fallback is `expo-crypto` AES-GCM (verify availability first).

- [ ] **Step 2: Failing tests** `encryptedStore.test.ts`

```ts
import { createEncryptedStore } from '@/shared/supabase/encryptedStore';
import { memoryKv } from '@/shared/lib/kv';

const counterBytes = (() => { let n = 1; return (len: number) => Uint8Array.from({ length: len }, () => (n++ % 251)); })();

function make(over: { secure?: ReturnType<typeof memoryKv>; plain?: ReturnType<typeof memoryKv> } = {}) {
  const secure = over.secure ?? memoryKv();
  const plain = over.plain ?? memoryKv();
  const store = createEncryptedStore({ secure, plain, randomBytes: counterBytes, storageKey: 'bh-auth' });
  return { store, secure, plain };
}

describe('encrypted store', () => {
  it('round-trips a session larger than 2 KB', async () => {
    const { store } = make();
    const big = JSON.stringify({ access_token: 'a'.repeat(3000), user: { id: 'u' } });
    await store.setItem('bh-auth', big);
    expect(await store.getItem('bh-auth')).toBe(big);
  });

  it('keeps ciphertext (not plaintext) in the plain store and only the key in the secure store', async () => {
    const { store, secure, plain } = make();
    await store.setItem('bh-auth', 'super-secret-session');
    expect(Object.values(plain.dump()).join('')).not.toContain('super-secret-session');
    expect(Object.keys(secure.dump())).toContain('bh-auth.k');
    expect(Object.values(secure.dump()).join('')).not.toContain('super-secret-session');
  });

  it('returns null when nothing is stored, and removeItem clears both halves', async () => {
    const { store, secure, plain } = make();
    expect(await store.getItem('bh-auth')).toBeNull();
    await store.setItem('bh-auth', 'x');
    await store.removeItem('bh-auth');
    expect(await store.getItem('bh-auth')).toBeNull();
    expect(secure.dump()['bh-auth.k']).toBeUndefined();
    expect(plain.dump()['bh-auth']).toBeUndefined();
  });

  it('returns null (does not throw) when the ciphertext is corrupt', async () => {
    const { store, plain } = make();
    await store.setItem('bh-auth', 'x');
    await plain.set('bh-auth', 'zz-not-hex');
    expect(await store.getItem('bh-auth')).toBeNull();
  });

  it('wipes a leftover Keychain key on a fresh install (no install marker)', async () => {
    const secure = memoryKv();
    await secure.set('bh-auth.k', 'aa'.repeat(32)); // iOS Keychain survived uninstall
    const plain = memoryKv(); // app data is gone
    const { store } = make({ secure, plain });
    expect(await store.getItem('bh-auth')).toBeNull();
    expect(secure.dump()['bh-auth.k']).toBeUndefined();
    expect(plain.dump()['bh.installed']).toBe('1');
  });

  it('does not wipe on a normal launch (marker present)', async () => {
    const first = make();
    await first.store.setItem('bh-auth', 'keep-me');
    const second = createEncryptedStore({
      secure: first.secure, plain: first.plain, randomBytes: counterBytes, storageKey: 'bh-auth',
    });
    expect(await second.getItem('bh-auth')).toBe('keep-me');
  });
});
```

- [ ] **Step 3: Run → FAIL; implement** `src/shared/supabase/encryptedStore.ts`

```ts
import aes from 'aes-js';
import type { KeyValue } from '@/shared/lib/kv';

type Deps = {
  secure: KeyValue;
  plain: KeyValue;
  randomBytes: (n: number) => Uint8Array;
  storageKey: string;
};

const MARKER = 'bh.installed';

export function createEncryptedStore(deps: Deps) {
  const keyName = (k: string) => `${k}.k`;

  // Fresh install: the iOS Keychain can outlive an uninstall while app data does not.
  const ready = (async () => {
    if ((await deps.plain.get(MARKER)) === null) {
      await deps.secure.delete(keyName(deps.storageKey));
      await deps.plain.delete(deps.storageKey);
      await deps.plain.set(MARKER, '1');
    }
  })();

  async function getItem(k: string): Promise<string | null> {
    await ready;
    const [keyHex, cipherHex] = await Promise.all([deps.secure.get(keyName(k)), deps.plain.get(k)]);
    if (keyHex === null || cipherHex === null) return null;
    try {
      const key = aes.utils.hex.toBytes(keyHex);
      if (key.length !== 32 || !/^[0-9a-f]+$/i.test(cipherHex)) return null;
      const ctr = new aes.ModeOfOperation.ctr(key, new aes.Counter(1));
      return aes.utils.utf8.fromBytes(ctr.decrypt(aes.utils.hex.toBytes(cipherHex)));
    } catch {
      return null;
    }
  }

  async function setItem(k: string, value: string): Promise<void> {
    await ready;
    const key = deps.randomBytes(32);
    const ctr = new aes.ModeOfOperation.ctr(key, new aes.Counter(1));
    const cipher = ctr.encrypt(aes.utils.utf8.toBytes(value));
    await deps.secure.set(keyName(k), aes.utils.hex.fromBytes(key));
    await deps.plain.set(k, aes.utils.hex.fromBytes(cipher));
  }

  async function removeItem(k: string): Promise<void> {
    await ready;
    await deps.secure.delete(keyName(k));
    await deps.plain.delete(k);
  }

  return { getItem, setItem, removeItem };
}
```
(A fresh random key per write means the fixed counter is never reused with the same key.) Run → PASS.

- [ ] **Step 4: Platform adapters + Supabase client** `src/shared/supabase/client.ts`

```ts
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState } from 'react-native';
import { env } from '@/shared/config/env';
import type { KeyValue } from '@/shared/lib/kv';
import { createEncryptedStore } from './encryptedStore';

const secure: KeyValue = {
  get: (k) => SecureStore.getItemAsync(k),
  set: (k, v) => SecureStore.setItemAsync(k, v, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
  delete: (k) => SecureStore.deleteItemAsync(k),
};
const plain: KeyValue = {
  get: (k) => AsyncStorage.getItem(k),
  set: (k, v) => AsyncStorage.setItem(k, v),
  delete: (k) => AsyncStorage.removeItem(k),
};

export const STORAGE_KEY = 'bh-auth';

export const supabase = createClient(env.supabaseUrl, env.supabaseAnonKey, {
  auth: {
    storage: createEncryptedStore({
      secure,
      plain,
      randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
      storageKey: STORAGE_KEY,
    }),
    storageKey: STORAGE_KEY,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (s) => {
  if (s === 'active') void supabase.auth.startAutoRefresh();
  else void supabase.auth.stopAutoRefresh();
});
```
Install `@supabase/supabase-js` first: `npx expo install @supabase/supabase-js`. SecureStore key names allow `[A-Za-z0-9._-]`; `bh-auth.k` is valid. Verify `SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY` exists in the installed typings (typecheck will fail if not — then read the v57 SecureStore page and use the documented constant).

- [ ] **Step 5: Verify** — `npm test && npm run typecheck && npx expo lint`.

- [ ] **Step 6: Commit** — `git add src/shared/supabase package.json package-lock.json && git commit -m "feat(auth): encrypted session store + supabase client"`.

### Task 11: Query client, platform wiring, authed API instance

**Files:** Create `src/shared/api/queryClient.ts`, `src/shared/api/instance.ts`, `src/shared/lib/storage.ts`, `src/shared/api/__tests__/queryClient.test.ts`.

**Interfaces:** Produces `queryClient`, `setupQueryManagers(): () => void`, `api` (authed client singleton), `appKv` (`KeyValue` over AsyncStorage).

- [ ] **Step 1: Install**

```bash
npx expo install @tanstack/react-query expo-network expo-application
```

- [ ] **Step 2: Failing test** `queryClient.test.ts`

```ts
import { shouldRetryQuery } from '@/shared/api/queryClient';

describe('shouldRetryQuery', () => {
  it('retries retryable api errors up to 2 times', () => {
    expect(shouldRetryQuery(0, { kind: 'network' })).toBe(true);
    expect(shouldRetryQuery(1, { kind: 'unavailable', status: 503 })).toBe(true);
    expect(shouldRetryQuery(2, { kind: 'network' })).toBe(false);
  });
  it('never retries non-retryable or unknown errors', () => {
    expect(shouldRetryQuery(0, { kind: 'forbidden' })).toBe(false);
    expect(shouldRetryQuery(0, new Error('boom'))).toBe(false);
  });
});
```

- [ ] **Step 3: Implement** `src/shared/api/queryClient.ts`

```ts
import { focusManager, onlineManager, QueryClient } from '@tanstack/react-query';
import * as Network from 'expo-network';
import { AppState, Platform } from 'react-native';
import { isRetryable, type ApiError } from '@/shared/lib/errors';

function isApiError(e: unknown): e is ApiError {
  return typeof e === 'object' && e !== null && 'kind' in e;
}

export function shouldRetryQuery(failureCount: number, error: unknown): boolean {
  return failureCount < 2 && isApiError(error) && isRetryable(error);
}

export const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: shouldRetryQuery, staleTime: 30_000, refetchOnReconnect: true } },
});

export function setupQueryManagers(): () => void {
  const appSub = AppState.addEventListener('change', (s) => {
    if (Platform.OS !== 'web') focusManager.setFocused(s === 'active');
  });
  onlineManager.setEventListener((setOnline) => {
    void Network.getNetworkStateAsync().then((s) => setOnline(s.isConnected === true));
    const sub = Network.addNetworkStateListener((s) => setOnline(s.isConnected === true));
    return () => sub.remove();
  });
  return () => appSub.remove();
}
```
(`getNetworkStateAsync` / `addNetworkStateListener` / `isConnected` verified in SDK 57 docs; `typecheck` is the gate.)

- [ ] **Step 4: `src/shared/lib/storage.ts`** — AsyncStorage-backed `appKv: KeyValue` (same shape as `plain` in Task 10). Reuse: export `plainKv` from here and import it in `supabase/client.ts` instead of the local copy (edit Task 10's file accordingly).

- [ ] **Step 5: Authed API singleton** `src/shared/api/instance.ts`

```ts
import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { env } from '@/shared/config/env';
import { createClock } from '@/shared/lib/clock';
import { plainKv } from '@/shared/lib/storage';
import { supabase } from '@/shared/supabase/client';
import { createApiClient } from './client';

export const clock = createClock({ storage: plainKv, now: () => Date.now() });
void clock.load();

const version = Application.nativeApplicationVersion ?? '0.0.0';
const build = Application.nativeBuildVersion ?? '0';

export const api = createApiClient({
  baseUrl: env.apiBaseUrl,
  fetchFn: (...a) => fetch(...a),
  getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
  refreshSession: async () => (await supabase.auth.refreshSession()).data.session?.access_token ?? null,
  clock,
  appVersion: `${version} (${build})`,
  platform: Platform.OS,
});
export const APP_VERSION = version;
```

- [ ] **Step 6: Verify + commit** — `npm test && npm run typecheck && npx expo lint`; `git add src package.json package-lock.json && git commit -m "feat(api): query client managers and authed API instance"`.

### Task 12: Auth state (reducer, error mapping, store, sign-in)

**Files:** Create `src/features/auth/domain/{authState.ts,signInErrors.ts}`, `src/features/auth/domain/__tests__/*.test.ts`, `src/features/auth/schemas/signIn.ts`, `src/features/auth/hooks/useAuth.ts`, `src/features/auth/api/session.ts`.

**Interfaces:** Produces `reduceAuth(state, event): AuthState`, `AuthState = { status: 'loading' } | { status: 'signedOut' } | { status: 'signedIn'; userId: string; email: string }`, `SessionEvent`, `mapSignInError(e): SignInError`, `signInSchema`, hook `useAuth(): { state; signIn(email,pw): Promise<SignInResult>; signOut(): Promise<void> }`.

- [ ] **Step 1: Failing reducer test** `authState.test.ts`

```ts
import { reduceAuth, type AuthState } from '@/features/auth/domain/authState';

const loading: AuthState = { status: 'loading' };
const session = { userId: 'u1', email: 'a@b.c' };

describe('reduceAuth', () => {
  it('INITIAL_SESSION with a session -> signedIn; without -> signedOut', () => {
    expect(reduceAuth(loading, { type: 'INITIAL_SESSION', session })).toEqual({ status: 'signedIn', ...session });
    expect(reduceAuth(loading, { type: 'INITIAL_SESSION', session: null })).toEqual({ status: 'signedOut' });
  });
  it('SIGNED_IN and TOKEN_REFRESHED/USER_UPDATED keep or set signedIn', () => {
    expect(reduceAuth({ status: 'signedOut' }, { type: 'SIGNED_IN', session })).toMatchObject({ status: 'signedIn' });
    expect(reduceAuth({ status: 'signedIn', ...session }, { type: 'TOKEN_REFRESHED', session })).toMatchObject({ status: 'signedIn' });
  });
  it('only an explicit SIGNED_OUT signs the user out; a refresh event without a session does not', () => {
    const signedIn: AuthState = { status: 'signedIn', ...session };
    expect(reduceAuth(signedIn, { type: 'TOKEN_REFRESHED', session: null })).toEqual(signedIn);
    expect(reduceAuth(signedIn, { type: 'SIGNED_OUT' })).toEqual({ status: 'signedOut' });
  });
});
```
Implement `authState.ts`:
```ts
export type SessionLite = { userId: string; email: string };
export type AuthState =
  | { status: 'loading' }
  | { status: 'signedOut' }
  | ({ status: 'signedIn' } & SessionLite);
export type SessionEvent =
  | { type: 'INITIAL_SESSION'; session: SessionLite | null }
  | { type: 'SIGNED_IN'; session: SessionLite }
  | { type: 'TOKEN_REFRESHED'; session: SessionLite | null }
  | { type: 'USER_UPDATED'; session: SessionLite | null }
  | { type: 'SIGNED_OUT' };

export function reduceAuth(state: AuthState, event: SessionEvent): AuthState {
  switch (event.type) {
    case 'INITIAL_SESSION':
      return event.session ? { status: 'signedIn', ...event.session } : { status: 'signedOut' };
    case 'SIGNED_IN':
      return { status: 'signedIn', ...event.session };
    case 'TOKEN_REFRESHED':
    case 'USER_UPDATED':
      return event.session ? { status: 'signedIn', ...event.session } : state;
    case 'SIGNED_OUT':
      return { status: 'signedOut' };
  }
}
```
(Review Focus #1: a failed background refresh must not sign the user out — covered by the `TOKEN_REFRESHED` null case.)

- [ ] **Step 2: Sign-in error mapping test + code** `signInErrors.test.ts`

```ts
import { mapSignInError } from '@/features/auth/domain/signInErrors';

it.each([
  [{ status: 400, code: 'invalid_credentials' }, 'invalidCredentials'],
  [{ status: 400, code: 'email_not_confirmed' }, 'emailNotConfirmed'],
  [{ status: 429, code: 'over_request_rate_limit' }, 'rateLimited'],
  [{ status: 429 }, 'rateLimited'],
  [{ name: 'AuthRetryableFetchError', status: 0 }, 'network'],
  [{ status: 500 }, 'unavailable'],
  [{ status: 400, code: 'something_else' }, 'unknown'],
  [{}, 'unknown'],
])('%j -> %s', (e, expected) => expect(mapSignInError(e)).toBe(expected));
```
`signInErrors.ts`:
```ts
export type SignInError =
  | 'invalidCredentials' | 'emailNotConfirmed' | 'rateLimited' | 'network' | 'unavailable' | 'unknown';

type Raw = { status?: number; code?: string; name?: string };

export function mapSignInError(e: Raw): SignInError {
  if (e.code === 'invalid_credentials') return 'invalidCredentials';
  if (e.code === 'email_not_confirmed') return 'emailNotConfirmed';
  if (e.status === 429 || e.code === 'over_request_rate_limit') return 'rateLimited';
  if (e.name === 'AuthRetryableFetchError' || e.status === 0) return 'network';
  if (typeof e.status === 'number' && e.status >= 500) return 'unavailable';
  return 'unknown';
}
export const signInCopy: Record<SignInError, string> = {
  invalidCredentials: 'That email or password is not right. Check them and try again.',
  emailNotConfirmed: 'Confirm your email first. We sent you a link when you signed up.',
  rateLimited: 'Too many attempts. Please try again in a minute.',
  network: 'We couldn’t reach the server. Check your connection and try again.',
  unavailable: 'Something went wrong on our side. Please try again shortly.',
  unknown: 'We couldn’t sign you in. Please try again.',
};
```

- [ ] **Step 3: Schema test + code** `src/features/auth/schemas/signIn.ts`

```ts
import { z } from 'zod';
export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});
export type SignInInput = z.infer<typeof signInSchema>;
```
Test (`schemas/__tests__/signIn.test.ts`): trims/lowercases `'  A@B.COM '` → `'a@b.com'`; rejects `'nope'`; rejects empty password.

- [ ] **Step 4: Platform glue** `src/features/auth/hooks/useAuth.ts` — Zustand store:

```ts
import { create } from 'zustand';
import { reduceAuth, type AuthState, type SessionEvent } from '@/features/auth/domain/authState';
import { mapSignInError, type SignInError } from '@/features/auth/domain/signInErrors';
import { supabase } from '@/shared/supabase/client';

type Store = {
  state: AuthState;
  dispatch: (e: SessionEvent) => void;
  signIn: (email: string, password: string) => Promise<SignInError | null>;
  signOut: () => Promise<void>;
};

export const useAuth = create<Store>((set, get) => ({
  state: { status: 'loading' },
  dispatch: (e) => set({ state: reduceAuth(get().state, e) }),
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? mapSignInError(error) : null;
  },
  async signOut() {
    await supabase.auth.signOut();
  },
}));
```
`src/features/auth/api/session.ts` — `startSessionListener()` subscribes `supabase.auth.onAuthStateChange((event, session) => …)` and dispatches `INITIAL_SESSION | SIGNED_IN | TOKEN_REFRESHED | USER_UPDATED | SIGNED_OUT` (mapping `session?.user.id/email` into `SessionLite`; other events ignored); returns the unsubscribe function. Install: `npx expo install zustand`.

- [ ] **Step 5: Verify** — `npx jest src/features/auth && npm run typecheck && npx expo lint`.

- [ ] **Step 6: Commit** — `git add src/features/auth package.json package-lock.json && git commit -m "feat(auth): auth state reducer, sign-in error mapping, store"`.

### Task 13: Mode resolution and routing (pure)

**Files:** Create `src/features/mode/domain/{resolveMode.ts,route.ts}`, tests `src/features/mode/domain/__tests__/{resolveMode,route}.test.ts`.

**Interfaces:** Produces:

```ts
type Role = 'customer' | 'vendor' | 'admin' | 'receptionist' | 'support';
type Mode = 'customer' | 'gate' | 'receptionist';
type ModeInputs = { role: Role; hotelStaff: { hotelId: string } | null; activeScannerCount: number };
type ModeResolution = { kind: 'webOnly' } | { kind: 'modes'; modes: Mode[]; defaultMode: Mode };
resolveMode(inputs: ModeInputs, lastMode?: Mode | null): ModeResolution
type AppRoute = 'loading' | 'update' | 'auth' | 'modeError' | 'webOnly' | 'gate' | 'receptionist' | 'customer';
resolveRoute(a: { versionOk: boolean; auth: AuthKind; mode: ModeState; chosenMode: Mode | null }): AppRoute
type ModeState = { status: 'idle' } | { status: 'loading' } | { status: 'error' } | { status: 'ready'; resolution: ModeResolution }
```

- [ ] **Step 1: Failing tests** `resolveMode.test.ts`

```ts
import { resolveMode } from '@/features/mode/domain/resolveMode';

const base = { hotelStaff: null, activeScannerCount: 0 } as const;

describe('resolveMode', () => {
  it.each(['vendor', 'admin', 'support'] as const)('%s -> web only', (role) => {
    expect(resolveMode({ ...base, role })).toEqual({ kind: 'webOnly' });
  });
  it('receptionist with a hotel_staff row -> receptionist', () => {
    expect(resolveMode({ role: 'receptionist', hotelStaff: { hotelId: 'h' }, activeScannerCount: 0 })).toEqual({
      kind: 'modes', modes: ['receptionist'], defaultMode: 'receptionist',
    });
  });
  it('receptionist role WITHOUT a hotel_staff row is not a receptionist (falls to customer)', () => {
    expect(resolveMode({ ...base, role: 'receptionist' })).toEqual({
      kind: 'modes', modes: ['customer'], defaultMode: 'customer',
    });
  });
  it('active scanner assignment -> gate (and customer stays available)', () => {
    expect(resolveMode({ ...base, role: 'customer', activeScannerCount: 2 })).toEqual({
      kind: 'modes', modes: ['gate', 'customer'], defaultMode: 'gate',
    });
  });
  it('plain customer -> customer only', () => {
    expect(resolveMode({ ...base, role: 'customer' })).toEqual({ kind: 'modes', modes: ['customer'], defaultMode: 'customer' });
  });
  it('honours the remembered mode only when it is still available', () => {
    const inputs = { role: 'customer', hotelStaff: null, activeScannerCount: 1 } as const;
    expect(resolveMode(inputs, 'customer')).toMatchObject({ defaultMode: 'customer' });
    expect(resolveMode(inputs, 'receptionist')).toMatchObject({ defaultMode: 'gate' });
  });
});
```
Implement `resolveMode.ts`:
```ts
export type Role = 'customer' | 'vendor' | 'admin' | 'receptionist' | 'support';
export type Mode = 'customer' | 'gate' | 'receptionist';
export type ModeInputs = { role: Role; hotelStaff: { hotelId: string } | null; activeScannerCount: number };
export type ModeResolution = { kind: 'webOnly' } | { kind: 'modes'; modes: Mode[]; defaultMode: Mode };

export function resolveMode(i: ModeInputs, lastMode: Mode | null = null): ModeResolution {
  if (i.role === 'vendor' || i.role === 'admin' || i.role === 'support') return { kind: 'webOnly' };
  const modes: Mode[] = [];
  if (i.role === 'receptionist' && i.hotelStaff) modes.push('receptionist');
  if (i.activeScannerCount > 0) modes.push('gate');
  modes.push('customer');
  const preferred = lastMode && modes.includes(lastMode) ? lastMode : null;
  return { kind: 'modes', modes, defaultMode: preferred ?? (modes[0] as Mode) };
}
```

- [ ] **Step 2: Routing test + code** `route.test.ts`

```ts
import { resolveRoute } from '@/features/mode/domain/route';

const ready = (resolution: Parameters<typeof resolveRoute>[0]['mode'] & { status: 'ready' }) => resolution;
const single = { status: 'ready', resolution: { kind: 'modes', modes: ['gate'], defaultMode: 'gate' } } as const;

describe('resolveRoute', () => {
  it('update gate wins over everything', () => {
    expect(resolveRoute({ versionOk: false, auth: 'signedIn', mode: single, chosenMode: null })).toBe('update');
  });
  it('shows loading while auth or mode is loading', () => {
    expect(resolveRoute({ versionOk: true, auth: 'loading', mode: { status: 'idle' }, chosenMode: null })).toBe('loading');
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: { status: 'loading' }, chosenMode: null })).toBe('loading');
  });
  it('signed out -> auth', () => {
    expect(resolveRoute({ versionOk: true, auth: 'signedOut', mode: { status: 'idle' }, chosenMode: null })).toBe('auth');
  });
  it('mode lookup error -> modeError, never customer', () => {
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: { status: 'error' }, chosenMode: null })).toBe('modeError');
  });
  it('web-only accounts', () => {
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: { status: 'ready', resolution: { kind: 'webOnly' } }, chosenMode: null })).toBe('webOnly');
  });
  it('uses the chosen mode if available, else the default', () => {
    const m = { status: 'ready', resolution: { kind: 'modes', modes: ['gate', 'customer'], defaultMode: 'gate' } } as const;
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: m, chosenMode: 'customer' })).toBe('customer');
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: m, chosenMode: 'receptionist' })).toBe('gate');
    expect(resolveRoute({ versionOk: true, auth: 'signedIn', mode: m, chosenMode: null })).toBe('gate');
  });
});
```
(Delete the unused `ready` helper line when writing the file.) `route.ts`:
```ts
import type { Mode, ModeResolution } from './resolveMode';

export type ModeState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; resolution: ModeResolution };
export type AuthKind = 'loading' | 'signedOut' | 'signedIn';
export type AppRoute =
  | 'loading' | 'update' | 'auth' | 'modeError' | 'webOnly' | 'gate' | 'receptionist' | 'customer';

type Input = { versionOk: boolean; auth: AuthKind; mode: ModeState; chosenMode: Mode | null };

export function resolveRoute(i: Input): AppRoute {
  if (!i.versionOk) return 'update';
  if (i.auth === 'loading') return 'loading';
  if (i.auth === 'signedOut') return 'auth';
  switch (i.mode.status) {
    case 'idle':
    case 'loading':
      return 'loading';
    case 'error':
      return 'modeError';
    case 'ready': {
      const r = i.mode.resolution;
      if (r.kind === 'webOnly') return 'webOnly';
      return i.chosenMode && r.modes.includes(i.chosenMode) ? i.chosenMode : r.defaultMode;
    }
  }
}
```

- [ ] **Step 3: Run → PASS; commit** — `git add src/features/mode && git commit -m "feat(mode): pure mode resolution and app routing"`.

### Task 14: Mode data fetching (Supabase reads under RLS)

**Files:** Create `src/features/mode/schemas/rows.ts`, `src/features/mode/api/loadModeInputs.ts`, `src/features/mode/hooks/useModeState.ts`, `src/features/mode/domain/lastMode.ts`, `src/features/mode/schemas/__tests__/rows.test.ts`, `src/features/mode/api/__tests__/loadModeInputs.test.ts`.

**Interfaces:** Consumes `ModeInputs`, `Result`, `ApiError`. Produces `loadModeInputs(db: ModeDb, userId: string): Promise<Result<ModeInputs, ApiError>>` where `ModeDb` is a thin interface so the function is unit-testable:

```ts
type ModeDb = {
  profile(userId: string): Promise<{ data: unknown; error: { code?: string; status?: number } | null }>;
  hotelStaff(userId: string): Promise<{ data: unknown; error: { code?: string; status?: number } | null }>;
  activeScanners(userId: string): Promise<{ data: unknown; error: { code?: string; status?: number } | null }>;
};
```

- [ ] **Step 1: Row schemas + test** `rows.ts`

```ts
import { z } from 'zod';
export const profileRow = z.object({
  id: z.string(),
  role: z.enum(['customer', 'vendor', 'admin', 'receptionist', 'support']),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});
export const hotelStaffRow = z.object({ hotel_id: z.string() }).nullable();
export const scannerRows = z.array(z.object({ id: z.string() }));
```
Test: accepts a valid profile; rejects an unknown role (`'owner'`); accepts `null` hotel staff; accepts `[]` scanners.

- [ ] **Step 2: Failing test** `loadModeInputs.test.ts`

```ts
import { loadModeInputs } from '@/features/mode/api/loadModeInputs';

const okRes = (data: unknown) => Promise.resolve({ data, error: null });
const errRes = (status: number) => Promise.resolve({ data: null, error: { status } });

const db = (over: Partial<Parameters<typeof loadModeInputs>[0]> = {}) => ({
  profile: () => okRes({ id: 'u', role: 'customer' }),
  hotelStaff: () => okRes(null),
  activeScanners: () => okRes([]),
  ...over,
});

describe('loadModeInputs', () => {
  it('assembles inputs', async () => {
    const r = await loadModeInputs(
      db({ profile: () => okRes({ id: 'u', role: 'receptionist' }), hotelStaff: () => okRes({ hotel_id: 'h1' }), activeScanners: () => okRes([{ id: 's' }]) }),
      'u',
    );
    expect(r).toEqual({ ok: true, value: { role: 'receptionist', hotelStaff: { hotelId: 'h1' }, activeScannerCount: 1 } });
  });
  it('a failed profile lookup is an error (never defaults to customer)', async () => {
    const r = await loadModeInputs(db({ profile: () => errRes(503) }), 'u');
    expect(r.ok).toBe(false);
  });
  it('a failed scanner or hotel lookup is also an error, not "no assignment"', async () => {
    expect((await loadModeInputs(db({ activeScanners: () => errRes(500) }), 'u')).ok).toBe(false);
    expect((await loadModeInputs(db({ hotelStaff: () => errRes(500) }), 'u')).ok).toBe(false);
  });
  it('a profile with an unexpected shape is a validation error', async () => {
    const r = await loadModeInputs(db({ profile: () => okRes({ id: 'u', role: 'owner' }) }), 'u');
    expect(r).toEqual({ ok: false, error: { kind: 'validation' } });
  });
  it('a missing profile row (null) is not found, not customer', async () => {
    const r = await loadModeInputs(db({ profile: () => okRes(null) }), 'u');
    expect(r).toEqual({ ok: false, error: { kind: 'notFound' } });
  });
});
```

- [ ] **Step 3: Implement** `loadModeInputs.ts`

```ts
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';
import type { ModeInputs } from '@/features/mode/domain/resolveMode';
import { hotelStaffRow, profileRow, scannerRows } from '@/features/mode/schemas/rows';

type Res = { data: unknown; error: { code?: string; status?: number } | null };
export type ModeDb = {
  profile(userId: string): Promise<Res>;
  hotelStaff(userId: string): Promise<Res>;
  activeScanners(userId: string): Promise<Res>;
};

function toApiError(e: { code?: string; status?: number }): ApiError {
  if (e.status === 401 || e.status === 403) return { kind: 'forbidden' };
  if (typeof e.status === 'number' && e.status >= 500) return { kind: 'unavailable', status: e.status };
  if (e.status === undefined || e.status === 0) return { kind: 'network' };
  return { kind: 'unknown', status: e.status };
}

export async function loadModeInputs(db: ModeDb, userId: string): Promise<Result<ModeInputs, ApiError>> {
  const [p, h, s] = await Promise.all([db.profile(userId), db.hotelStaff(userId), db.activeScanners(userId)]);
  if (p.error) return err(toApiError(p.error));
  if (h.error) return err(toApiError(h.error));
  if (s.error) return err(toApiError(s.error));
  if (p.data === null) return err({ kind: 'notFound' });
  const profile = profileRow.safeParse(p.data);
  const staff = hotelStaffRow.safeParse(h.data);
  const scanners = scannerRows.safeParse(s.data);
  if (!profile.success || !staff.success || !scanners.success) return err({ kind: 'validation' });
  return ok({
    role: profile.data.role,
    hotelStaff: staff.data ? { hotelId: staff.data.hotel_id } : null,
    activeScannerCount: scanners.data.length,
  });
}
```
Run → PASS.

- [ ] **Step 4: Supabase-backed `ModeDb`** in `src/features/mode/hooks/useModeState.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { loadModeInputs, type ModeDb } from '@/features/mode/api/loadModeInputs';
import { resolveMode, type Mode } from '@/features/mode/domain/resolveMode';
import type { ModeState } from '@/features/mode/domain/route';
import { plainKv } from '@/shared/lib/storage';
import { supabase } from '@/shared/supabase/client';

const db: ModeDb = {
  profile: (id) => supabase.from('users').select('id,role,name,email').eq('id', id).maybeSingle().then((r) => ({ data: r.data, error: r.error })),
  hotelStaff: (id) => supabase.from('hotel_staff').select('hotel_id').eq('user_id', id).maybeSingle().then((r) => ({ data: r.data, error: r.error })),
  activeScanners: (id) => supabase.from('event_scanners').select('id').eq('user_id', id).eq('is_active', true).then((r) => ({ data: r.data, error: r.error })),
};

const LAST_MODE = 'bh.lastMode';

export function useModeState(userId: string | null): {
  state: ModeState; chosen: Mode | null; choose: (m: Mode) => void; retry: () => void;
} {
  const [chosen, setChosen] = useState<Mode | null>(null);
  useEffect(() => { void plainKv.get(LAST_MODE).then((v) => { if (v === 'customer' || v === 'gate' || v === 'receptionist') setChosen(v); }); }, []);

  const q = useQuery({
    queryKey: ['mode', userId],
    enabled: userId !== null,
    queryFn: async () => {
      const r = await loadModeInputs(db, userId ?? '');
      if (!r.ok) throw r.error;
      return r.value;
    },
  });

  let state: ModeState = { status: 'idle' };
  if (userId !== null) {
    if (q.isPending) state = { status: 'loading' };
    else if (q.isError) state = { status: 'error' };
    else state = { status: 'ready', resolution: resolveMode(q.data, chosen) };
  }
  return {
    state, chosen,
    choose: (m) => { setChosen(m); void plainKv.set(LAST_MODE, m); },
    retry: () => { void q.refetch(); },
  };
}
```
(PostgREST errors don't carry `status` on `supabase-js` result `error` objects in all versions — if `.error.status` is absent the mapper returns `network`/`unknown`; **check on device in Task 17 that a deliberately blocked request produces the retry screen, not customer.**)

- [ ] **Step 5: Verify + commit** — `npm test && npm run typecheck && npx expo lint`; `git add src/features/mode && git commit -m "feat(mode): load mode inputs under RLS"`.

### Task 15: Navigation shells, sign-in, web-only, mode-error, root layout

**Files:** Create/modify `src/app/_layout.tsx`, `src/app/(auth)/_layout.tsx`, `src/app/(auth)/sign-in.tsx`, `src/app/(gate)/index.tsx`, `src/app/(receptionist)/index.tsx`, `src/app/(customer)/index.tsx`, `src/app/web-only.tsx`, `src/app/update-required.tsx`, `src/app/mode-error.tsx`, `src/features/auth/screens/SignInScreen.tsx`, `src/features/{gate,receptionist,customer}/screens/*Shell.tsx`, `src/shared/providers/AppProviders.tsx`, `src/shared/ui/ScreenError.tsx`, `src/features/auth/screens/__tests__/SignInScreen.test.tsx`.

**Interfaces:** Consumes everything above. `SignInScreen({ onSubmit }: { onSubmit: (email: string, password: string) => Promise<SignInError | null> })`.

- [ ] **Step 1: Failing screen test** `SignInScreen.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SignInScreen } from '@/features/auth/screens/SignInScreen';

it('validates inputs before calling onSubmit', async () => {
  const onSubmit = jest.fn();
  render(<SignInScreen onSubmit={onSubmit} />);
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('shows the mapped error copy and never blocks retry', async () => {
  const onSubmit = jest.fn().mockResolvedValue('network');
  render(<SignInScreen onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'pw');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(screen.getByText(/couldn’t reach the server/i)).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled?.();
});

it('rate limited copy tells the user to wait a minute', async () => {
  const onSubmit = jest.fn().mockResolvedValue('rateLimited');
  render(<SignInScreen onSubmit={onSubmit} />);
  fireEvent.changeText(screen.getByLabelText('Email'), 'a@b.com');
  fireEvent.changeText(screen.getByLabelText('Password'), 'pw');
  fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => expect(screen.getByText(/try again in a minute/i)).toBeTruthy());
});
```
(If `toBeEnabled` isn't available in the installed RNTL matchers, replace that line with `expect(screen.getByRole('button', { name: 'Sign in' }).props.accessibilityState.disabled).toBe(false)`.)

- [ ] **Step 2: Implement `SignInScreen`** — local state for email/password/error/submitting; on press: `signInSchema.safeParse` → set field errors (`Enter a valid email address` / `Enter your password`); else `setSubmitting(true)`, `const e = await onSubmit(parsed.email, parsed.password)`, `setError(e ? signInCopy[e] : null)`, `setSubmitting(false)`. Fields: `Input label="Email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="username"`, `Input label="Password" secureTextEntry autoComplete="password" textContentType="password"`; `Button label="Sign in" loading={submitting}`; the error rendered in a `status.danger` box with `accessibilityLiveRegion="polite"`. No "sign up"/"forgot password" links (web work pending); a muted line: "New to Bookhushly? Create your account on bookhushly.com." with `expo-web-browser`/`Linking` open on press (`https://www.bookhushly.com`).

- [ ] **Step 3: Shells** — each `*Shell` is `ShellPlaceholder` with title ("Gate staff", "Front desk", "Bookhushly"), subtitle ("Scanning arrives in Phase 1." / "Check-in arrives in Phase 3." / "Browsing and booking arrive in Phase 4."), `identity` and `onSignOut` props. The routes `(gate)/index.tsx` etc. read `useAuth` for identity and wire `signOut`.

- [ ] **Step 4: Root layout** `src/app/_layout.tsx`

```tsx
import * as SplashScreen from 'expo-splash-screen';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { startSessionListener } from '@/features/auth/api/session';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { resolveRoute } from '@/features/mode/domain/route';
import { useModeState } from '@/features/mode/hooks/useModeState';
import { APP_VERSION } from '@/shared/api/instance';
import { setupQueryManagers } from '@/shared/api/queryClient';
import { isVersionSupported, MIN_SUPPORTED_VERSION } from '@/shared/lib/version';
import { AppProviders } from '@/shared/providers/AppProviders';

void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const auth = useAuth((s) => s.state);
  const userId = auth.status === 'signedIn' ? auth.userId : null;
  const { state: mode, chosen } = useModeState(userId);
  const route = resolveRoute({
    versionOk: isVersionSupported(APP_VERSION, MIN_SUPPORTED_VERSION),
    auth: auth.status,
    mode,
    chosenMode: chosen,
  });

  useEffect(() => {
    if (route !== 'loading') void SplashScreen.hideAsync();
  }, [route]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={route === 'update'}><Stack.Screen name="update-required" /></Stack.Protected>
      <Stack.Protected guard={route === 'auth'}><Stack.Screen name="(auth)" /></Stack.Protected>
      <Stack.Protected guard={route === 'modeError'}><Stack.Screen name="mode-error" /></Stack.Protected>
      <Stack.Protected guard={route === 'webOnly'}><Stack.Screen name="web-only" /></Stack.Protected>
      <Stack.Protected guard={route === 'gate'}><Stack.Screen name="(gate)" /></Stack.Protected>
      <Stack.Protected guard={route === 'receptionist'}><Stack.Screen name="(receptionist)" /></Stack.Protected>
      <Stack.Protected guard={route === 'customer'}><Stack.Screen name="(customer)" /></Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => startSessionListener(), []);
  useEffect(() => setupQueryManagers(), []);
  return (
    <AppProviders>
      <StatusBar style="dark" />
      <Navigator />
    </AppProviders>
  );
}
```
`AppProviders` = `QueryClientProvider client={queryClient}` + `SafeAreaProvider`. Remove `src/app/index.tsx`'s preview redirect (keep `__preview` reachable only in `__DEV__` via direct URL). `update-required.tsx`: `Screen` with title "Update Bookhushly", body "This version is no longer supported. Update the app to continue.", a button opening the store URL (`Linking.openURL` with the Play Store URL placeholder constant `STORE_URL` in `src/shared/config/store.ts` — owner supplies the real listing URL before release; until then the button is hidden when `STORE_URL` is empty). `web-only.tsx`: title "Use the web dashboard", body "Vendor, admin and support accounts are managed on bookhushly.com.", buttons "Open bookhushly.com" and "Sign out". `mode-error.tsx`: title "We couldn’t load your account", body "Check your connection and try again.", buttons "Try again" (`retry` from `useModeState`) and "Sign out" — this screen never shows a mode.

- [ ] **Step 5: Run** — `npx jest src/features && npm run typecheck && npx expo lint`.

- [ ] **Step 6: Commit** — `git add src && git commit -m "feat: navigation shells, sign-in, web-only, mode-error, root layout"`.

### Task 16: One real authenticated call

**Files:** Create `src/features/auth/api/getKycStatus.ts` (temporary probe), `src/features/auth/api/__tests__/probe.test.ts`; surface the result in the customer shell identity card (dev only).

- [ ] **Step 1: Decide the probe from the backend, not from memory** — run the `backend-contract-checker` agent on `GET /api/customer/kyc` (BACKEND_STATUS §7: returns `{ kyc: … }`, auth via `getAuthUser`, Bearer-capable) and confirm the response shape and auth behaviour. If it is unsuitable, use `GET /api/health` (public) *plus* a Bearer-requiring read chosen by the agent.

- [ ] **Step 2: Test with a fake client** — `getKycStatus(api)` returns `Result<{ kyc: unknown }, ApiError>`; test that a 401 from the fake client yields `{ kind: 'auth' }` and a 200 `{ kyc: null }` yields ok.

- [ ] **Step 3: Implement** with `api.request('/api/customer/kyc', { schema: z.object({ kyc: z.unknown() }) })`. Show "API: ok / <error kind>" in the dev-only block of `ShellPlaceholder`'s caller (only when `__DEV__`).

- [ ] **Step 4: Commit** — `git add src && git commit -m "feat(api): authenticated probe call"`.

### Task 17: Release build on the Moto G06 — milestone 0.3 verification

**Files:** none (verification + notes). Record results in `docs/superpowers/plans/2026-10-04-phase-0-foundations.md` under "Status log".

- [ ] **Step 1: Prerequisite from the owner** — a **customer test account on production**, created through the real web sign-up flow and email-confirmed. (No gate/receptionist account yet: those shells are covered by unit tests of `resolveMode`/`resolveRoute`; manual check only when accounts exist.)

- [ ] **Step 2: Release build**

```bash
npx expo run:android --variant release --device
```
(or `npx eas-cli@latest build --profile preview --platform android` and install the APK). Confirm `.env.local` is present for local builds.

- [ ] **Step 3: Checklist on the phone** (owner runs; Claude records):
  1. Cold start: splash holds, then the sign-in screen; fonts correct, no fallback flash.
  2. Wrong password → "That email or password is not right…", button usable again.
  3. Correct sign-in → customer shell shows the right email.
  4. Force-stop and relaunch → straight into the customer shell (session restored).
  5. Airplane mode, then cold start → still signed in (offline restore); sign out stays possible.
  6. Airplane mode at sign-in attempt → "couldn’t reach the server", **not** "wrong password".
  7. Sign out → back to sign-in; relaunch stays signed out.
  8. Dev-only API probe shows ok (or a clear error kind) — not a crash.
  9. Scroll/transition smoothness subjectively acceptable; note anything that stutters (baseline, M7).
- [ ] **Step 4: If LargeSecureStore misbehaves on device** (aes-js/polyfill failure): stop, record the exact error, and apply the spec's fallback (`expo-crypto` AES-GCM — verify availability in the v57 docs first) via a new task rather than patching around it.
- [ ] **Step 5: Run `/verify` and `/review-changes`**; fix findings. Commit any fixes.

---

# Milestone 0.4 — Hardening

### Task 18: Error boundaries, Sentry, cleanup

**Files:** Create `src/shared/ui/ScreenError.tsx`, route `ErrorBoundary` exports in each route group `_layout`, `src/shared/lib/monitoring.ts`; Modify `app.json`, `metro.config.js`, `src/app/_layout.tsx`; Delete `src/app/__preview.tsx`.

- [ ] **Step 1: `ScreenError`** — `({ error, retry }: { error: Error; retry: () => void })` renders title "Something went wrong", body "Your data is safe. Try again.", `Button label="Try again" onPress={retry}`, never prints `error.message`; reports via `monitoring.captureException(error)`. Test with RNTL: renders retry, pressing calls `retry`, does not display the error text.

- [ ] **Step 2: Export `ErrorBoundary`** from the root `_layout.tsx` and each group layout: `export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';` Also set `unstable_settings = { screenErrorBoundary: true }` only after confirming the option exists in the v57 router docs (error-handling page); otherwise skip.

- [ ] **Step 3: Sentry**

```bash
npx expo install @sentry/react-native
```
Add the plugin to `app.json` (`"@sentry/react-native/expo"`; add options only as the v57/Sentry docs require). Create/modify `metro.config.js`: `const { getSentryExpoConfig } = require('@sentry/react-native/metro'); module.exports = getSentryExpoConfig(__dirname);`. `monitoring.ts`:

```ts
import * as Sentry from '@sentry/react-native';
import { env } from '@/shared/config/env';

export function initMonitoring(release: string): void {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    release,
    tracesSampleRate: 0.1,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) event.user = { id: event.user.id };
      delete event.request?.cookies;
      return event;
    },
  });
}
export function captureException(e: unknown): void {
  if (env.sentryDsn) Sentry.captureException(e);
}
```
Call `initMonitoring(`${APP_VERSION}`)` at module scope in `_layout.tsx` and `export default Sentry.wrap(RootLayout)`. If the owner has not supplied a DSN, this is a no-op (record in status; owner action: create the Sentry project and set `EXPO_PUBLIC_SENTRY_DSN` + `SENTRY_AUTH_TOKEN` as an EAS secret).

- [ ] **Step 4: Remove the throwaway** — `git rm src/app/__preview.tsx`; `grep -rn "__preview" src` returns nothing.

- [ ] **Step 5: Verify** — `npm test && npm run typecheck && npx expo lint && npx expo-doctor`; on the phone, trigger a thrown render error via a temporary debug button (remove it after) and confirm the boundary + retry appear; if a DSN exists, confirm the event arrives in Sentry.

- [ ] **Step 6: Commit** — `git add -A src app.json metro.config.js package.json package-lock.json && git commit -m "feat: error boundaries, Sentry, remove preview route"`.

### Task 19: Docs, final verification, handoff

**Files:** Modify `docs/BACKEND_STATUS.md` (§9 additions found during the work), `CLAUDE.md` (any rule learned), `docs/superpowers/plans/2026-10-04-phase-0-foundations.md` (status log).

- [ ] **Step 1: Update docs** — add to BACKEND_STATUS §9 anything discovered (e.g. `supabase-js` error `status` availability, any RLS surprise, the min-version endpoint, sign-up/forgot-password routes still needed); add to `docs/ENGINEERING_STANDARDS.md` §9 the verification results (aes-js on Hermes, `expo-network` listener behaviour, SecureStore constant names, `lucide-react-native` status, RNTL peer).
- [ ] **Step 2: Full gate** — `/verify` then `/review-changes` (rn-code-reviewer, ux-design-reviewer, mobile-security-reviewer). Fix findings; re-run until clean.
- [ ] **Step 3: Success-criteria audit** — tick each of the four spec success criteria with evidence (command output / device checklist). Anything unmet is reported as such, not rounded up.
- [ ] **Step 4: Handoff note** — status log lists: what shipped, what was verified on the Moto G06, open owner actions (Sentry DSN, store URL, package identifier confirmation, gate/receptionist test accounts), and the recommended Phase 1 starting point (`/new-feature gate/event-list`).
- [ ] **Step 5: Commit** — `git add docs CLAUDE.md && git commit -m "docs: phase 0 learnings and status"`.

---

## Self-Review

**Spec coverage:** §1 success criteria → Tasks 17, 19. §2.1 layout → File Structure + Tasks 3–15. §2.2 config/env → Tasks 2, 7. §2.3 auth/session (LargeSecureStore, marker, AppState, store, errors) → Tasks 10–12. §2.4 mode resolution → Tasks 13–14. §2.5 API client + clock + taxonomy + query client → Tasks 7–9, 11, 16. §2.6 navigation/shells/boundaries → Tasks 15, 18. §2.7 theme/fonts/primitives/contrast/delete template → Tasks 3–6. §2.8 logger/Sentry/version gate/web-only → Tasks 7, 15, 18. §2.9 tooling/CI/EAS → Tasks 1–2, 6, 17. Milestones 0.1–0.4 map to Tasks 1–2 / 3–6 / 7–17 / 18–19. Out-of-scope items are not planned. Account-sheet identity (FR-1.9) is exposed via `ShellPlaceholder` identity; the full sheet is Phase 1.

**Placeholder scan:** the only deliberate "confirm at the moment" items are *verification* steps, each with a concrete command (font file names → `find`/`fontTools`; SecureStore constant → typecheck; `toBeEnabled` fallback; `unstable_settings` → router docs). `STORE_URL` is an owner-supplied constant, hidden when empty.

**Type consistency:** `Result/ok/err` (Task 1) used in Tasks 9, 14; `KeyValue/memoryKv` (Task 8) used in Tasks 10–11 (`plainKv` in `shared/lib/storage.ts`, Task 11, imported back into Task 10's client); `ApiError`/`isRetryable`/`errorFromResponse` (Task 7) used in Tasks 9, 11, 14; `Clock` (Task 8) in Tasks 9, 11; `ModeInputs/Mode/ModeResolution` (Task 13) in Task 14; `ModeState/AuthKind/resolveRoute` (Task 13) in Task 15; `SignInError/signInCopy` (Task 12) in Task 15; `AuthState` kinds `'loading'|'signedOut'|'signedIn'` match `AuthKind`. Note: Task 10's `client.ts` initially defines its own `plain`; Task 11 Step 4 moves it to `shared/lib/storage.ts` and updates the import.

**Review Focus coverage:** #1 → Task 12 reducer test (+ Task 17 step 5). #2 → Task 10 tests. #3 → Tasks 7–9 tests. #4 → Task 9 tests. #5 → Tasks 13–14 tests + Task 17.

---

## Status log

_(Filled in during execution.)_
