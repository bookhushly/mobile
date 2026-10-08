import type { ScannableEvent } from '@/shared/api/scannableEvents';

export type EventGroups = { upcoming: ScannableEvent[]; earlier: ScannableEvent[] };

// Doors stay open after the listed start time; keep tonight's event at the top.
const STILL_ON_MS = 12 * 60 * 60 * 1000;

const startOf = (e: ScannableEvent) => (e.startsAt === null ? NaN : Date.parse(e.startsAt));

export function groupEvents(events: readonly ScannableEvent[], nowMs: number): EventGroups {
  const upcoming: ScannableEvent[] = [];
  const earlier: ScannableEvent[] = [];
  for (const e of events) {
    const t = startOf(e);
    if (Number.isFinite(t) && t < nowMs - STILL_ON_MS) earlier.push(e);
    else upcoming.push(e);
  }
  const key = (e: ScannableEvent) => {
    const t = startOf(e);
    return Number.isFinite(t) ? t : Number.POSITIVE_INFINITY;
  };
  upcoming.sort((a, b) => key(a) - key(b));
  earlier.sort((a, b) => startOf(b) - startOf(a));
  return { upcoming, earlier };
}

// Only an upcoming event: reopening last week's event would refuse every valid ticket tonight.
export function pickAutoOpen(
  events: readonly ScannableEvent[],
  lastEventId: string | null,
  nowMs: number,
): string | null {
  if (lastEventId === null) return null;
  return groupEvents(events, nowMs).upcoming.some((e) => e.id === lastEventId) ? lastEventId : null;
}

export function eventLabel(e: ScannableEvent): string {
  return e.title ?? `Event · ${e.id.slice(0, 8)}`;
}

export type EventStatus = 'live' | 'today' | 'upcoming' | 'ended';

export function eventStatus(e: ScannableEvent, nowMs: number): EventStatus | null {
  const t = startOf(e);
  if (!Number.isFinite(t)) return null;
  if (t <= nowMs) return nowMs < t + STILL_ON_MS ? 'live' : 'ended';
  const a = new Date(t);
  const n = new Date(nowMs);
  const sameDay =
    a.getFullYear() === n.getFullYear() &&
    a.getMonth() === n.getMonth() &&
    a.getDate() === n.getDate();
  return sameDay ? 'today' : 'upcoming';
}

export type DateTile = { month: string; day: string; weekday: string };

export function dateTile(e: ScannableEvent): DateTile | null {
  const t = startOf(e);
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return {
    month: d.toLocaleDateString('en-NG', { month: 'short' }),
    day: String(d.getDate()),
    weekday: d.toLocaleDateString('en-NG', { weekday: 'short' }),
  };
}
