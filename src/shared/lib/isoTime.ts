// Postgres jsonb timestamps carry microseconds ("…T18:04:00.123456+00:00"); trim to
// milliseconds before Date.parse so every JS engine reads them the same way.
const FRACTION = /(\.\d{3})\d+/;

export function parseIsoMs(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null;
  const t = Date.parse(iso.replace(FRACTION, '$1'));
  return Number.isFinite(t) ? t : null;
}
