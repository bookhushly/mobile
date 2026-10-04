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
  status: {
    success: { bg: palette.successWash, fg: palette.successInk, solid: palette.success },
    warning: { bg: palette.warningWash, fg: palette.warningInk, solid: palette.warning },
    danger: { bg: palette.dangerWash, fg: palette.dangerInk, solid: palette.danger },
    info: { bg: palette.infoWash, fg: palette.infoInk, solid: palette.info },
  },
  outcome: {
    admitted: { bg: palette.gateAdmitted, fg: palette.white },
    used: { bg: palette.gateUsed, fg: palette.white },
    refused: { bg: palette.gateRefused, fg: palette.white },
    retry: { bg: palette.gateRetry, fg: palette.white },
  },
} as const;

export type ColorRole = 'textPrimary' | 'textSecondary' | 'textMuted' | 'onAction' | 'linkText';
export type SurfaceRole = 'surface' | 'canvas' | 'wash' | 'actionFill' | 'selectedWash';
