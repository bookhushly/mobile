export type DensityName = 'customer' | 'work' | 'gate';

export const density = {
  // minTarget: smallest touch target for secondary controls (links, icon buttons).
  customer: { controlHeight: 48, rowMin: 56, targetGap: 12, minTarget: 44 },
  work: { controlHeight: 48, rowMin: 64, targetGap: 12, minTarget: 44 },
  gate: { controlHeight: 64, rowMin: 72, targetGap: 16, minTarget: 48 },
} as const satisfies Record<
  DensityName,
  { controlHeight: number; rowMin: number; targetGap: number; minTarget: number }
>;
