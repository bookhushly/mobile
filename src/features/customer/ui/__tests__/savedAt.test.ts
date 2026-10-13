import { savedAtLabel } from '@/features/customer/ui/savedAt';

const now = Date.parse('2026-10-13T11:00:00Z');

it('gives the Lagos time for a save today, and the day too for an older one', () => {
  expect(savedAtLabel(Date.parse('2026-10-13T09:42:00Z'), now)).toBe('10:42');
  expect(savedAtLabel(Date.parse('2026-10-11T22:30:00Z'), now)).toBe('Sun 11 Oct, 23:30');
  // 23:30 UTC is already the next Lagos day.
  expect(savedAtLabel(Date.parse('2026-10-12T23:30:00Z'), now)).toBe('00:30');
});
