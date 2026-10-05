export type DensityName = 'customer' | 'work' | 'gate';

export const density = {
  customer: { controlHeight: 48, rowMin: 56, targetGap: 12 },
  work: { controlHeight: 48, rowMin: 64, targetGap: 12 },
  gate: { controlHeight: 64, rowMin: 72, targetGap: 16 },
} as const satisfies Record<
  DensityName,
  { controlHeight: number; rowMin: number; targetGap: number }
>;
