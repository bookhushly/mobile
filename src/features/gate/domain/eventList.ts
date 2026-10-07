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
