// NFR-3.3: the roster (PII) leaves the phone after the event + grace. The scannable-events list
// only has a start time: keep it through the doors day plus 48 h.
const KEEP_MS = 72 * 60 * 60 * 1000;

export function listExpiry(startsAt: string | null): number | null {
  if (startsAt === null) return null;
  const t = Date.parse(startsAt);
  return Number.isFinite(t) ? t + KEEP_MS : null;
}
