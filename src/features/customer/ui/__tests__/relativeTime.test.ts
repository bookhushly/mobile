import { relativeTime } from '@/features/customer/ui/relativeTime';

// 12:00 Lagos on Tue 13 Oct.
const now = Date.parse('2026-10-13T11:00:00Z');

it('reads minutes, hours, yesterday and older dates in Lagos time', () => {
  expect(relativeTime('2026-10-13T10:59:30Z', now)).toBe('Just now');
  expect(relativeTime('2026-10-13T11:00:20Z', now)).toBe('Just now');
  expect(relativeTime('2026-10-13T10:55:00Z', now)).toBe('5 min ago');
  expect(relativeTime('2026-10-13T08:00:00Z', now)).toBe('3 h ago');
  // 23:30 UTC on the 12th is 00:30 Lagos on the 13th: still today.
  expect(relativeTime('2026-10-12T23:30:00Z', now)).toBe('11 h ago');
  expect(relativeTime('2026-10-12T22:30:00Z', now)).toBe('Yesterday');
  expect(relativeTime('2026-10-10T09:00:00Z', now)).toBe('Sat 10 Oct');
  expect(relativeTime('not a date', now)).toBe('');
});
