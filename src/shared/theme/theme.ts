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
  // Links are text-coloured and underlined; violet is saved for the primary action.
  linkText: palette.ink,
  selectedWash: palette.violet100,
  // The opening screen only: matches the native splash (app.json), so the hand-over is seamless.
  brand: palette.violet600,
  // The scanner's dark surface (camera letterbox, top/bottom bars over the camera).
  inverse: palette.ink,
  onInverse: palette.white,
  // The event hero (Luma's poster page): tiles raised off the ink, and its quieter text.
  inverseRaised: palette.inkRaised,
  onInverseMuted: palette.onInkMuted,
  accent: {
    // Score badge: white on green (5.3:1), like Expedia's "9.0 Wonderful".
    rating: { bg: palette.ratingGreen, fg: palette.white },
    // A tag on promotions ("This weekend", "Free"): ink on yellow (12:1).
    deal: { bg: palette.dealYellow, fg: palette.ink },
    // The lead promo card: a flat ink block, white text, its art a softer grey (never yellow fills).
    dark: { bg: palette.ink, fg: palette.white, deep: palette.inkSoft },
    // The soft disc behind a highlight icon.
    tint: { bg: palette.violet50, fg: palette.violet700, deep: palette.violet100 },
  },
  scrim: [palette.scrimClear, palette.scrimMid, palette.scrimEnd] as const,
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
  onInverseMuted: color.onInverseMuted,
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
