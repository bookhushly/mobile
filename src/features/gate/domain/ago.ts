const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

export function ago(thenMs: number, nowMs: number): string {
  const d = Math.max(0, nowMs - thenMs);
  if (d < MIN) return 'just now';
  if (d < HOUR) return `${String(Math.floor(d / MIN))} min ago`;
  if (d < 2 * DAY) return `${String(Math.floor(d / HOUR))} h ago`;
  return `${String(Math.floor(d / DAY))} days ago`;
}
