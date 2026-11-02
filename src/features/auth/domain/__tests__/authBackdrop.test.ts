import { nextPhotoIndex } from '@/features/auth/domain/authBackdrop';

describe('nextPhotoIndex', () => {
  it('steps through the photos and wraps', () => {
    expect(nextPhotoIndex(0)).toBe(1);
    expect(nextPhotoIndex(2)).toBe(0);
  });
});
