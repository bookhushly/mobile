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
