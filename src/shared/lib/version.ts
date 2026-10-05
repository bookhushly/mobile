function parts(v: string): number[] | null {
  const p = v.split('.').map((x) => Number(x));
  return p.length > 0 && p.every((n) => Number.isInteger(n) && n >= 0) ? p : null;
}

export function isVersionSupported(current: string, min: string): boolean {
  const c = parts(current);
  const m = parts(min);
  if (!c || !m) return true;
  for (let i = 0; i < Math.max(c.length, m.length); i++) {
    const a = c[i] ?? 0;
    const b = m[i] ?? 0;
    if (a !== b) return a > b;
  }
  return true;
}

export const MIN_SUPPORTED_VERSION = '1.0.0';
