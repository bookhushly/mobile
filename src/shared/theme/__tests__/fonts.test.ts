import { fontFamily } from '@/shared/theme/fonts';

describe('fontFamily', () => {
  it('returns a distinct family per weight for sans', () => {
    const set = new Set([400, 500, 600].map((w) => fontFamily('sans', w as 400 | 500 | 600)));
    expect(set.size).toBe(3);
  });
  it('serif only ships weight 500 and falls back to it', () => {
    expect(fontFamily('serif', 600)).toBe(fontFamily('serif', 500));
  });
});
