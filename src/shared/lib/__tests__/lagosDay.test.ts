import {
  daysBetween,
  isIsoDate,
  lagosTime,
  lagosToday,
  longDate,
  shortDate,
  stayRange,
} from '@/shared/lib/lagosDay';

it('rolls to the next day at 23:00 UTC (WAT is UTC+1)', () => {
  expect(lagosToday(Date.UTC(2026, 9, 10, 22, 59))).toBe('2026-10-10');
  expect(lagosToday(Date.UTC(2026, 9, 10, 23, 30))).toBe('2026-10-11');
});
it('counts days across months and backwards', () => {
  expect(daysBetween('2026-10-11', '2026-10-14')).toBe(3);
  expect(daysBetween('2026-10-30', '2026-11-02')).toBe(3);
  expect(daysBetween('2026-10-14', '2026-10-11')).toBe(-3);
  expect(daysBetween('2026-12-31', '2027-01-01')).toBe(1);
});
it('formats dates', () => {
  expect(shortDate('2026-10-14')).toBe('Wed 14 Oct');
  expect(longDate('2026-10-11')).toBe('Sunday 11 October');
  expect(stayRange('2026-10-11', '2026-10-14')).toBe('11–14 Oct');
  expect(stayRange('2026-10-30', '2026-11-02')).toBe('30 Oct – 2 Nov');
  expect(stayRange('2026-12-31', '2027-01-02')).toBe('31 Dec – 2 Jan');
});
it('shows Lagos wall time for an ISO instant', () => {
  expect(lagosTime('2026-10-11T09:42:00Z')).toBe('10:42');
  expect(lagosTime('2026-10-11T23:05:00+00:00')).toBe('00:05');
  expect(lagosTime('nonsense')).toBe('');
});
it('validates ISO dates', () => {
  expect(isIsoDate('2026-02-29')).toBe(false);
  expect(isIsoDate('2028-02-29')).toBe(true);
  expect(isIsoDate('2026-1-01')).toBe(false);
});
