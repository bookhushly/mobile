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
  // The scanner's dark surface (camera letterbox, top/bottom bars over the camera).
  inverse: palette.ink,
  onInverse: palette.white,
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
