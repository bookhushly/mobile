import { lagosClock12, lagosToday, shortDate } from '@/shared/lib/lagosDay';

/** "10:42 am" when saved today, else "Sat 10 Oct, 10:42 am" (Lagos wall time, 12-hour). */
export function savedAtLabel(savedAt: number, now: number): string {
  const iso = new Date(savedAt).toISOString();
  const day = lagosToday(savedAt);
  const time = lagosClock12(iso);
  return day === lagosToday(now) ? time : `${shortDate(day)}, ${time}`;
}
