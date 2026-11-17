export type DensityName = 'customer' | 'work' | 'gate';

export const density = {
  // minTarget: smallest touch target for secondary controls (links, icon buttons).
  // fieldHeight: text fields, tall enough for the title inside the box above the value (64 since
  // the 2026-11-15 type sizes: a 15/22 title over a 19/28 value; 58 squeezed the value).
  customer: { controlHeight: 52, fieldHeight: 64, rowMin: 56, targetGap: 12, minTarget: 44 },
  work: { controlHeight: 48, fieldHeight: 64, rowMin: 64, targetGap: 12, minTarget: 44 },
  gate: { controlHeight: 64, fieldHeight: 68, rowMin: 72, targetGap: 16, minTarget: 48 },
} as const satisfies Record<
  DensityName,
  {
    controlHeight: number;
    fieldHeight: number;
    rowMin: number;
    targetGap: number;
    minTarget: number;
  }
>;
