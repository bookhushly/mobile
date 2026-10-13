import { qrPath } from '@/shared/lib/qrMatrix';

it('builds a version 1 code for a short hotel check-in code, deterministically', () => {
  const a = qrPath('AB12CD34');
  expect(a.size).toBe(21);
  expect(a.d.startsWith('M')).toBe(true);
  expect(qrPath('AB12CD34').d).toBe(a.d);
});

it('grows for longer payloads', () => {
  expect(qrPath('x'.repeat(300)).size).toBeGreaterThan(21);
});

it('draws one unit square per dark module', () => {
  const { d } = qrPath('AB12CD34');
  expect(d).toMatch(/^(M\d+ \d+h1v1h-1z)+$/);
});

it('accepts an empty string (the library encodes it as a version 1 code)', () => {
  const p = qrPath('');
  expect(p.size).toBe(21);
  expect(p.d.startsWith('M')).toBe(true);
});
