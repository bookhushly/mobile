import { daysBetween, lagosToday } from '@/shared/lib/lagosDay';

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

type Summary = { arriving: number; arrived: number; leaving: number; toConfirm: number };

/** The day in a line or two for a hotel or an apartment business. */
export function stayHeadline(kind: 'hotel' | 'apartment', s: Summary): string[] {
  if (kind === 'hotel') {
    if (s.arriving === 0 && s.leaving === 0) return ['No arrivals today'];
    const a = s.arriving === 0 ? 'No arrivals today' : `${String(s.arriving)} arriving today`;
    return s.leaving === 0 ? [a] : [`${a},`, `${String(s.leaving)} leaving`];
  }
  const first =
    s.toConfirm > 0 ? plural(s.toConfirm, 'booking to confirm', 'bookings to confirm') : null;
  const ins = s.arriving > 0 ? plural(s.arriving, 'check-in today', 'check-ins today') : null;
  if (first !== null && ins !== null) return [`${first},`, ins];
  return [first ?? ins ?? 'No check-ins today'];
}

/** "Lagos Jazz Night / is in 2 days". */
export function eventHeadline(
  title: string | null,
  startsAt: string | null,
  nowMs: number,
): string[] {
  if (title === null || startsAt === null) return ['No events coming up'];
  const days = daysBetween(lagosToday(nowMs), lagosToday(Date.parse(startsAt)));
  return [
    title,
    days <= 0 ? 'is today' : days === 1 ? 'is tomorrow' : `is in ${String(days)} days`,
  ];
}
