export type FontKind = 'sans';

export type VariantSpec = {
  font: FontKind;
  weight: 400 | 500 | 600;
  size: number;
  lineHeight: number;
  letterSpacing: number;
  maxScale: number;
};

// Sizes moved up one step on 2026-11-13 after measuring against Nike, Booking.com and IHG, and a
// second step on 2026-11-14 and a third on 2026-11-15 (owner: still too small): Hanken's lowercase
// is small for its size (x-height 0.493 vs SF 0.508, Helvetica 0.523), so reading text sits at 19,
// secondary text at 17 and nothing drops below 15. Display headlines and the gate's result sizes (`outcome`, `num*`)
// are unchanged.
export const typeVariants = {
  caption: {
    font: 'sans',
    weight: 400,
    size: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
    maxScale: 1.6,
  },
  labelSm: {
    font: 'sans',
    weight: 600,
    size: 15,
    lineHeight: 22,
    letterSpacing: 0.2,
    maxScale: 1.6,
  },
  label: { font: 'sans', weight: 600, size: 17, lineHeight: 24, letterSpacing: 0, maxScale: 1.6 },
  // Form field labels only; controls and links keep `label`.
  fieldLabel: {
    font: 'sans',
    weight: 500,
    size: 17,
    lineHeight: 24,
    letterSpacing: 0,
    maxScale: 1.6,
  },
  bodySm: { font: 'sans', weight: 400, size: 17, lineHeight: 24, letterSpacing: 0, maxScale: 1.6 },
  body: { font: 'sans', weight: 400, size: 19, lineHeight: 28, letterSpacing: 0, maxScale: 1.6 },
  // Button labels. Hanken's 600 matches the stroke of Nike's medium (Helvetica Neue Medium):
  // measured stem/cap 0.166 vs 0.175; Hanken 500 is 0.146, close to Helvetica's regular.
  button: { font: 'sans', weight: 600, size: 19, lineHeight: 28, letterSpacing: 0, maxScale: 1.6 },
  // Standalone links (under a form, beside buttons): one step quieter than a button.
  linkLg: { font: 'sans', weight: 500, size: 19, lineHeight: 28, letterSpacing: 0, maxScale: 1.6 },
  bodyStrong: {
    font: 'sans',
    weight: 600,
    size: 19,
    lineHeight: 28,
    letterSpacing: 0,
    maxScale: 1.6,
  },
  // The line under a form headline (Airbnb, Nike): a step above body so it doesn't read as fine print.
  subtitle: {
    font: 'sans',
    weight: 400,
    size: 20,
    lineHeight: 30,
    letterSpacing: 0,
    maxScale: 1.6,
  },
  // Subline under a display headline.
  lead: { font: 'sans', weight: 400, size: 20, lineHeight: 28, letterSpacing: 0, maxScale: 1.3 },
  headline: {
    font: 'sans',
    weight: 600,
    size: 22,
    lineHeight: 30,
    letterSpacing: 0,
    maxScale: 1.3,
  },
  title: {
    font: 'sans',
    weight: 600,
    size: 24,
    lineHeight: 32,
    letterSpacing: -0.2,
    maxScale: 1.3,
  },
  titleLg: {
    font: 'sans',
    weight: 600,
    size: 28,
    lineHeight: 36,
    letterSpacing: -0.3,
    maxScale: 1.3,
  },
  // Form and page headlines: 30 at 500. Size carries the hierarchy, not weight (Nike, IHG).
  displaySm: {
    font: 'sans',
    weight: 500,
    size: 30,
    lineHeight: 36,
    letterSpacing: -0.75,
    maxScale: 1.15,
  },
  displayMd: {
    font: 'sans',
    weight: 500,
    size: 30,
    lineHeight: 36,
    letterSpacing: -0.75,
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
