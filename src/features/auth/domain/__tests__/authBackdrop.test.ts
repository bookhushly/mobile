import { SHEET_GAP_PT, sheetTop } from '@/features/auth/domain/authBackdrop';

it('rests the sheet a sliver below the safe area', () => {
  expect(sheetTop(50)).toBe(50 + SHEET_GAP_PT);
  expect(SHEET_GAP_PT).toBeLessThan(24);
});
