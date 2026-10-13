// Pure text for the booking details screen (C12).
import { clockLabel } from '@/features/customer/domain/myBookings';
import { daysBetween, shortDate, type IsoDate } from '@/shared/lib/lagosDay';

function plural(n: number, one: string, many: string): string {
  return `${String(n)} ${n === 1 ? one : many}`;
}

/** `ticket_details` → "2 × VIP, 1 × Regular"; null when there's nothing to say. */
export function packagesLine(details: Readonly<Record<string, number>> | null): string | null {
  if (details === null) return null;
  const parts = Object.entries(details)
    .filter(([name, n]) => name.trim() !== '' && Number.isInteger(n) && n > 0)
    .map(([name, n]) => `${String(n)} × ${name}`);
  return parts.length === 0 ? null : parts.join(', ');
}

/** "2 adults, 1 child"; null when neither is known. */
export function guestsLine(adults: number | null, children: number | null): string | null {
  const parts: string[] = [];
  if (adults !== null && adults > 0) parts.push(plural(adults, 'adult', 'adults'));
  if (children !== null && children > 0) parts.push(plural(children, 'child', 'children'));
  return parts.length === 0 ? null : parts.join(', ');
}

export function guestsCount(n: number | null): string | null {
  return n === null || n <= 0 ? null : plural(n, 'guest', 'guests');
}

export function nightsLabel(n: number): string {
  return plural(n, 'night', 'nights');
}

/** Apple Maps on iOS, Google Maps elsewhere; the query is the venue or address as written. */
export function mapsUrl(query: string, os: string): string {
  const q = encodeURIComponent(query.trim());
  return os === 'ios' ? `https://maps.apple.com/?q=${q}` : `https://maps.google.com/?q=${q}`;
}

/** "Wed 15 Oct · from 2:00 pm" (stays) or "Sun 18 Oct · 7:00 pm" (events); the day alone without a time. */
export function dayAt(d: IsoDate, time: string | null, word?: 'from' | 'by'): string {
  const t = clockLabel(time);
  if (t === null) return shortDate(d);
  return `${shortDate(d)} · ${word === undefined ? t : `${word} ${t}`}`;
}

/** An event's date line: one day with its time, or a multi-day run. */
export function eventWhen(start: IsoDate, end: IsoDate, time: string | null): string {
  if (daysBetween(start, end) > 0) {
    const t = clockLabel(time);
    const run = `${shortDate(start)} – ${shortDate(end)}`;
    return t === null ? run : `${run} · ${t}`;
  }
  return dayAt(start, time);
}

/** "12 Marina Rd, Lagos, Lagos State" from the parts that exist; null when none do. */
export function joinAddress(parts: readonly (string | null | undefined)[]): string | null {
  const s = parts
    .filter((p): p is string => typeof p === 'string' && p.trim() !== '')
    .map((p) => p.trim())
    .join(', ');
  return s === '' ? null : s;
}
