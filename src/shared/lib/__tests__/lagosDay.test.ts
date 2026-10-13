import {
  dayParts,
  daysBetween,
  isIsoDate,
  hour12,
  lagosClock12,
  lagosSeconds12,
  lagosWhen12,
  lagosTime,
  lagosToday,
  lagosWhen,
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
it('says the time alone for today and adds the date otherwise', () => {
  expect(lagosWhen('2026-10-11T09:42:00Z', '2026-10-11')).toBe('at 10:42');
  expect(lagosWhen('2026-10-10T09:42:00Z', '2026-10-11')).toBe('on Sat 10 Oct at 10:42');
  // 23:30Z is already the next Lagos day.
  expect(lagosWhen('2026-10-10T23:30:00Z', '2026-10-11')).toBe('at 00:30');
  expect(lagosWhen('nonsense', '2026-10-11')).toBe('');
});
it('validates ISO dates', () => {
  expect(isIsoDate('2026-02-29')).toBe(false);
  expect(isIsoDate('2028-02-29')).toBe(true);
  expect(isIsoDate('2026-1-01')).toBe(false);
});

it('splits a date into tile parts', () => {
  expect(dayParts('2026-10-18')).toEqual({ month: 'Oct', day: '18', weekday: 'Sun' });
  expect(dayParts('2027-01-01')).toEqual({ month: 'Jan', day: '1', weekday: 'Fri' });
});

it('formats a 24-hour clock as 12-hour with am/pm', () => {
  expect(hour12(0, '05')).toBe('12:05 am');
  expect(hour12(9, '42')).toBe('9:42 am');
  expect(hour12(12, '00')).toBe('12:00 pm');
  expect(hour12(19, '42', '07')).toBe('7:42:07 pm');
  expect(hour12(23, '59')).toBe('11:59 pm');
});
it('reads instants as the 12-hour Lagos clock', () => {
  expect(lagosClock12('2026-10-11T18:42:00Z')).toBe('7:42 pm');
  expect(lagosClock12('2026-10-11T23:05:00Z')).toBe('12:05 am');
  expect(lagosClock12('nonsense')).toBe('');
  expect(lagosSeconds12(Date.parse('2026-10-11T09:42:07Z'))).toBe('10:42:07 am');
  expect(lagosSeconds12(Date.parse('2026-10-11T23:05:59.999Z'))).toBe('12:05:59 am');
  expect(lagosSeconds12(Number.NaN)).toBe('');
});
it('says when in 12-hour time for today and adds the date otherwise', () => {
  expect(lagosWhen12('2026-10-11T18:42:00Z', '2026-10-11')).toBe('at 7:42 pm');
  expect(lagosWhen12('2026-10-10T09:42:00Z', '2026-10-11')).toBe('on Sat 10 Oct at 10:42 am');
  expect(lagosWhen12('2026-10-10T23:30:00Z', '2026-10-11')).toBe('at 12:30 am');
  expect(lagosWhen12('nonsense', '2026-10-11')).toBe('');
});
