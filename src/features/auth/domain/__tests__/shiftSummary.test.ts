import { hasShiftActivity, summaryLine } from '@/features/auth/domain/shiftSummary';

const zero = { admitted: 0, used: 0, refused: 0, couldntCheck: 0, toSync: 0 };

describe('summaryLine', () => {
  it('lists every non-zero outcome', () => {
    expect(summaryLine({ admitted: 12, used: 3, refused: 1, couldntCheck: 0, toSync: 2 })).toBe(
      'This shift: 12 admitted · 3 already used · 1 refused · 2 to sync',
    );
  });
  it('omits zero parts other than admitted', () => {
    expect(summaryLine({ ...zero, admitted: 1 })).toBe('This shift: 1 admitted');
  });
  it('words couldn’t check with a typographic apostrophe', () => {
    expect(summaryLine({ ...zero, admitted: 2, couldntCheck: 4 })).toBe('This shift: 2 admitted · 4 couldn’t check');
  });
});

describe('hasShiftActivity', () => {
  it('is false when everything is zero', () => {
    expect(hasShiftActivity(zero)).toBe(false);
  });
  it('is true when any count, including toSync, is non-zero', () => {
    expect(hasShiftActivity({ ...zero, toSync: 1 })).toBe(true);
    expect(hasShiftActivity({ ...zero, couldntCheck: 1 })).toBe(true);
  });
});
