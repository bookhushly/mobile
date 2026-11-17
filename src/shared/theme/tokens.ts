export const palette = {
  white: '#FFFFFF',
  // Neutral foundation (2026-11-13): black, white and plain greys carry the UI; violet is kept
  // for the primary action and selected state only (the Booking.com balance).
  canvas: '#F7F7F7',
  wash: '#F2F2F2',
  line: '#E5E5E5',
  lineStrong: '#8C8C8C',
  inkMuted: '#6B6B6B',
  inkSoft: '#474747',
  ink: '#141414',
  // On the dark event hero (Luma): raised tiles, and secondary text (9.8:1 on ink).
  inkRaised: '#2B2B2B',
  onInkMuted: '#BDBDBD',
  violet50: '#F4F1FF',
  violet100: '#EBE5FF',
  violet600: '#7C3AED',
  violet700: '#6D28D9',
  // Customer accents (2026-11-14, Expedia/Booking reference): a rating badge, a deal tag, and the
  // tinted disc behind highlight icons. Small areas only; the page stays neutral.
  ratingGreen: '#1E7A46',
  dealYellow: '#FFD84D',
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
  gateRetry: '#474747',
  // Neutral status ("couldn't reach", lookup/override markers): ink-soft text on wash.
  neutral: '#474747',
  // Legibility fade over auth photos (neutral black); the middle stop sits behind text.
  scrimClear: 'rgba(0,0,0,0)',
  scrimMid: 'rgba(0,0,0,0.55)',
  scrimEnd: 'rgba(0,0,0,0.8)',
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
