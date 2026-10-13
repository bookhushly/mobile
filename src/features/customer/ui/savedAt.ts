import { lagosTime, lagosToday, shortDate } from '@/shared/lib/lagosDay';

/** "10:42" when saved today, else "Sat 10 Oct, 10:42" (Lagos wall time). */
export function savedAtLabel(savedAt: number, now: number): string {
  const iso = new Date(savedAt).toISOString();
  const day = lagosToday(savedAt);
  return day === lagosToday(now) ? lagosTime(iso) : `${shortDate(day)}, ${lagosTime(iso)}`;
}
