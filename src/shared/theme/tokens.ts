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
  success: '#15803D',
  successWash: '#DCFCE7',
  successInk: '#14532D',
  warning: '#B45309',
  warningWash: '#FEF3C7',
  warningInk: '#78350F',
  danger: '#B91C1C',
  dangerWash: '#FEE2E2',
  dangerInk: '#7F1D1D',
  info: '#1D4ED8',
  infoWash: '#DBEAFE',
  infoInk: '#1E3A8A',
  gateAdmitted: '#166534',
  gateRefused: '#991B1B',
  gateUsedBg: '#FBBF24',
  gateRetry: '#4A4670',
} as const;

export const space = {
  s1: 2,
  s2: 4,
  s3: 8,
  s4: 12,
  s5: 16,
  s6: 20,
  s7: 24,
  s8: 32,
  s9: 40,
  s10: 48,
  s11: 64,
} as const;
export type SpaceKey = keyof typeof space;

export const radius = { r1: 4, r2: 8, r3: 12, r4: 16, rFull: 999 } as const;
export type RadiusKey = keyof typeof radius;
