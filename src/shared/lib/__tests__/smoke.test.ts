import { ok } from '@/shared/lib/result';

describe('toolchain', () => {
  it('resolves the @ alias', () => {
    expect(ok(1)).toEqual({ ok: true, value: 1 });
  });
});
