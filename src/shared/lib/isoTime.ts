// Postgres jsonb timestamps carry 1–6 fraction digits ("…T18:04:00.12+00:00", "….123456+00:00");
// make it exactly three (milliseconds) before Date.parse so every JS engine reads them the same way.
const FRACTION = /\.(\d+)/;

export function normaliseIso(iso: string): string {
  return iso.replace(FRACTION, (_m, d: string) => `.${d.slice(0, 3).padEnd(3, '0')}`);
}

export function parseIsoMs(iso: string | null | undefined): number | null {
  if (iso === null || iso === undefined) return null;
  const t = Date.parse(normaliseIso(iso));
  return Number.isFinite(t) ? t : null;
}
