import { nextPhotoIndex, sheetOffset } from '@/features/auth/domain/authBackdrop';

describe('nextPhotoIndex', () => {
  it('steps through the photos and wraps', () => {
    expect(nextPhotoIndex(0)).toBe(1);
    expect(nextPhotoIndex(2)).toBe(0);
  });
});

describe('sheetOffset', () => {
  it('puts the band below the safe area', () => {
    expect(sheetOffset('short', 50, false)).toBe(122);
    expect(sheetOffset('tall', 50, false)).toBe(210);
  });
  it('rises to the safe area when the keyboard is open', () => {
    expect(sheetOffset('tall', 50, true)).toBe(50);
  });
});
