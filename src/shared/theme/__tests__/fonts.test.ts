import { fontFamily } from '@/shared/theme/fonts';
import { typeVariants } from '@/shared/theme/type';

describe('fontFamily', () => {
  it('returns a distinct family per weight for sans', () => {
    const set = new Set([400, 500, 600].map((w) => fontFamily('sans', w as 400 | 500 | 600)));
    expect(set.size).toBe(3);
  });
  it('uses Hanken Grotesk (iOS PostScript names in the jest default platform)', () => {
    expect(fontFamily('sans', 400)).toBe('HankenGrotesk-Regular');
    expect(fontFamily('sans', 500)).toBe('HankenGrotesk-Medium');
    expect(fontFamily('sans', 600)).toBe('HankenGrotesk-SemiBold');
  });
  it('onboarding headlines are 500 at -2.5%; size carries the hierarchy (2026-11-13)', () => {
    for (const name of ['displaySm', 'displayMd'] as const) {
      const v = typeVariants[name];
      expect(v.weight).toBe(500);
      expect(v.letterSpacing).toBeCloseTo(v.size * -0.025);
    }
    expect(typeVariants.displaySm.size).toBe(30);
    // Hanken 600 is the stroke weight of Nike's medium; 500 reads thin (measured 2026-11-14).
    expect(typeVariants.button.weight).toBe(600);
    expect(typeVariants.linkLg.weight).toBe(500);
  });
  it('recipe B: the larger display variants stay sans 600 at -2%', () => {
    for (const name of ['display', 'displayLg', 'hero'] as const) {
      const v = typeVariants[name];
      expect(v.font).toBe('sans');
      expect(v.weight).toBe(600);
      expect(v.letterSpacing).toBeCloseTo(v.size * -0.02);
    }
    expect(typeVariants.fieldLabel.weight).toBe(500);
    expect(typeVariants.label.weight).toBe(600);
  });
});
