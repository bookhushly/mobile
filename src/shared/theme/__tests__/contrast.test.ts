import { contrastRatio } from '@/shared/theme/contrast';
import { color } from '@/shared/theme/theme';

const AA_TEXT = 4.5;
const AA_UI = 3;

describe('contrast', () => {
  it('computes known ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 1);
    expect(contrastRatio('#7C3AED', '#FFFFFF')).toBeCloseTo(5.7, 1);
  });

  const textPairs: [string, string][] = [
    [color.textPrimary, color.surface],
    [color.textPrimary, color.canvas],
    [color.textSecondary, color.surface],
    [color.textMuted, color.surface],
    [color.textMuted, color.canvas],
    [color.textMuted, color.wash],
    [color.onAction, color.actionFill],
    [color.linkText, color.surface],
    [color.outcome.admitted.fg, color.outcome.admitted.bg],
    [color.outcome.used.fg, color.outcome.used.bg],
    [color.outcome.refused.fg, color.outcome.refused.bg],
    [color.outcome.retry.fg, color.outcome.retry.bg],
    [color.status.success.fg, color.status.success.bg],
    [color.status.danger.fg, color.status.danger.bg],
    [color.status.warning.fg, color.status.warning.bg],
    [color.status.info.fg, color.status.info.bg],
  ];
  it.each(textPairs)('text %s on %s meets AA', (fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it('input borders meet 3:1 on surface', () => {
    expect(contrastRatio(color.borderStrong, color.surface)).toBeGreaterThanOrEqual(AA_UI);
  });

  it('gate outcome fills reach 7:1 for sunlight legibility', () => {
    for (const o of [
      color.outcome.admitted,
      color.outcome.used,
      color.outcome.refused,
      color.outcome.retry,
    ]) {
      expect(contrastRatio(o.fg, o.bg)).toBeGreaterThanOrEqual(7);
    }
  });
});
