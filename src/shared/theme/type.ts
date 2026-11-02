export type FontKind = 'sans';

export type VariantSpec = {
  font: FontKind;
  weight: 400 | 500 | 600;
  size: number;
  lineHeight: number;
  letterSpacing: number;
  maxScale: number;
};

export const typeVariants = {
  caption: {
    font: 'sans',
    weight: 400,
    size: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    maxScale: 1.6,
  },
  labelSm: {
    font: 'sans',
    weight: 600,
    size: 12,
    lineHeight: 16,
    letterSpacing: 0.2,
    maxScale: 1.6,
  },
  label: { font: 'sans', weight: 600, size: 14, lineHeight: 20, letterSpacing: 0, maxScale: 1.6 },
  // Form field labels only; controls and links keep `label`.
  fieldLabel: {
    font: 'sans',
    weight: 500,
    size: 14,
    lineHeight: 20,
    letterSpacing: 0,
    maxScale: 1.6,
  },
  bodySm: { font: 'sans', weight: 400, size: 14, lineHeight: 20, letterSpacing: 0, maxScale: 1.6 },
  body: { font: 'sans', weight: 400, size: 16, lineHeight: 24, letterSpacing: 0, maxScale: 1.6 },
  bodyStrong: {
    font: 'sans',
    weight: 600,
    size: 16,
    lineHeight: 24,
    letterSpacing: 0,
    maxScale: 1.6,
  },
  // Subline under a display headline.
  lead: { font: 'sans', weight: 500, size: 18, lineHeight: 26, letterSpacing: 0, maxScale: 1.3 },
  headline: {
    font: 'sans',
    weight: 600,
    size: 18,
    lineHeight: 28,
    letterSpacing: 0,
    maxScale: 1.3,
  },
  title: {
    font: 'sans',
    weight: 600,
    size: 20,
    lineHeight: 28,
    letterSpacing: -0.2,
    maxScale: 1.3,
  },
  titleLg: {
    font: 'sans',
    weight: 600,
    size: 24,
    lineHeight: 32,
    letterSpacing: -0.3,
    maxScale: 1.3,
  },
  displaySm: {
    font: 'sans',
    weight: 600,
    size: 32,
    lineHeight: 36,
    letterSpacing: -0.64,
    maxScale: 1.15,
  },
  displayMd: {
    font: 'sans',
    weight: 600,
    size: 36,
    lineHeight: 40,
    letterSpacing: -0.72,
    maxScale: 1.15,
  },
  display: {
    font: 'sans',
    weight: 600,
    size: 40,
    lineHeight: 48,
    letterSpacing: -0.8,
    maxScale: 1.15,
  },
  displayLg: {
    font: 'sans',
    weight: 600,
    size: 48,
    lineHeight: 56,
    letterSpacing: -0.96,
    maxScale: 1.15,
  },
  // Onboarding only.
  hero: { font: 'sans', weight: 600, size: 64, lineHeight: 68, letterSpacing: -1.28, maxScale: 1 },
  // Gate result titles: fixed size.
  outcome: {
    font: 'sans',
    weight: 600,
    size: 36,
    lineHeight: 44,
    letterSpacing: -0.5,
    maxScale: 1,
  },
  // Door counter.
  numLg: { font: 'sans', weight: 600, size: 48, lineHeight: 52, letterSpacing: -1, maxScale: 1 },
  num: { font: 'sans', weight: 600, size: 20, lineHeight: 28, letterSpacing: 0, maxScale: 1.3 },
  numXl: { font: 'sans', weight: 600, size: 64, lineHeight: 72, letterSpacing: -1, maxScale: 1 },
} as const satisfies Record<string, VariantSpec>;

export type Variant = keyof typeof typeVariants;
