import { daysBetween, lagosToday, shortDate } from '@/shared/lib/lagosDay';

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;

/** "Just now", "5 min ago", "3 h ago" (same Lagos day), "Yesterday", else "Sat 10 Oct". */
export function relativeTime(iso: string, now: number): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return '';
  const ago = now - at;
  // A server time slightly ahead of ours (skew) still reads as just now.
  if (ago < MIN_MS) return 'Just now';
  if (ago < HOUR_MS) return `${String(Math.floor(ago / MIN_MS))} min ago`;
  const day = lagosToday(at);
  const today = lagosToday(now);
  if (day === today) return `${String(Math.floor(ago / HOUR_MS))} h ago`;
  if (daysBetween(day, today) === 1) return 'Yesterday';
  return shortDate(day);
}
