import createQr from 'qrcode-generator';

import { qrPath } from '@/shared/lib/qrMatrix';

// The dark modules the library computes, as "c,r" keys: what any path must draw exactly.
function libraryModules(text: string): Set<string> {
  const qr = createQr(0, 'M');
  qr.addData(text, 'Byte');
  qr.make();
  const out = new Set<string>();
  const n = qr.getModuleCount();
  for (let r = 0; r < n; r++)
    for (let c = 0; c < n; c++) if (qr.isDark(r, c)) out.add(`${String(c)},${String(r)}`);
  return out;
}

// Decodes the path's run commands ("M c r h n v1 h-n z") back into the modules they fill.
function drawnModules(d: string): {
  modules: Set<string>;
  runs: { c: number; r: number; n: number }[];
} {
  const modules = new Set<string>();
  const runs: { c: number; r: number; n: number }[] = [];
  const cmd = /M(\d+) (\d+)h(\d+)v1h-(\d+)z/g;
  let consumed = 0;
  for (const m of d.matchAll(cmd)) {
    const [, cs, rs, ns, back] = m;
    const c = Number(cs);
    const r = Number(rs);
    const n = Number(ns);
    expect(Number(back)).toBe(n);
    runs.push({ c, r, n });
    for (let i = 0; i < n; i++) {
      const k = `${String(c + i)},${String(r)}`;
      expect(modules.has(k)).toBe(false); // no overlaps
      modules.add(k);
    }
    consumed += m[0].length;
  }
  expect(consumed).toBe(d.length); // nothing but run commands
  return { modules, runs };
}

const PAYLOADS = [
  'AB12CD34',
  '',
  'https://bookhushly.com/t/3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f',
  'BH2.' + 'x'.repeat(180),
  'x'.repeat(300),
];

it.each(PAYLOADS)('draws exactly the library’s dark modules (%#)', (text) => {
  const { size, d } = qrPath(text);
  const expected = libraryModules(text);
  const { modules } = drawnModules(d);
  expect(modules).toEqual(expected);
  expect(size * size).toBeGreaterThanOrEqual(expected.size);
});

it('merges each horizontal run of dark modules into one command', () => {
  const { runs } = drawnModules(qrPath('AB12CD34').d);
  const at = new Set(runs.map((x) => `${String(x.c)},${String(x.r)}`));
  for (const x of runs) {
    // A run never continues straight into another on the same row.
    expect(at.has(`${String(x.c + x.n)},${String(x.r)}`)).toBe(false);
  }
  // Fewer commands than modules (a version 1 code always has long runs, e.g. finder patterns).
  const modules = runs.reduce((sum, x) => sum + x.n, 0);
  expect(runs.length).toBeLessThan(modules);
});

it('builds a version 1 code for a short hotel check-in code, deterministically', () => {
  const a = qrPath('AB12CD34');
  expect(a.size).toBe(21);
  expect(qrPath('AB12CD34').d).toBe(a.d);
});

it('grows for longer payloads', () => {
  expect(qrPath('x'.repeat(300)).size).toBeGreaterThan(21);
});

it('accepts an empty string (the library encodes it as a version 1 code)', () => {
  expect(qrPath('').size).toBe(21);
});
