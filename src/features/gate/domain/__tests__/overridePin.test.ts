import { isPinShape, parseVerifier, verifyPin } from '@/features/gate/domain/overridePin';

// Known-answer vector published by the web (docs/superpowers/specs/2026-10-03-scan-override-pin-design.md).
const KAT = {
  enabled: true,
  alg: 'scrypt',
  N: 8192,
  r: 8,
  p: 1,
  dk_len: 32,
  salt: 'ABEiM0RVZneImaq7zN3u_w',
  hash: 'L8yIIos_9EAoJkqiN2s2Qv6pNMzKe65LM05K0fZtgeA',
  set_at: '2026-10-03T12:00:00Z',
};

describe('override PIN', () => {
  it('accepts the published known-answer vector', async () => {
    const v = parseVerifier(KAT);
    expect(v).not.toBeNull();
    if (v === null) return;
    await expect(verifyPin('123456', v)).resolves.toBe(true);
  });
  it('rejects a wrong PIN', async () => {
    const v = parseVerifier(KAT);
    if (v === null) throw new Error('fixture');
    await expect(verifyPin('123457', v)).resolves.toBe(false);
  });
  it.each([
    ['null', null],
    ['not scrypt', { ...KAT, alg: 'pbkdf2' }],
    ['N too large', { ...KAT, N: 65536 }],
    ['N not a power of two', { ...KAT, N: 8000 }],
    ['r too large', { ...KAT, r: 32 }],
    ['p too large', { ...KAT, p: 8 }],
    ['dk_len not 32', { ...KAT, dk_len: 64 }],
    ['short salt', { ...KAT, salt: 'ABEiM0RVZneImaq7' }],
    ['bad hash', { ...KAT, hash: 'nope' }],
    ['disabled', { ...KAT, enabled: false }],
  ])('treats %s as no usable override', (_n, raw) => {
    expect(parseVerifier(raw)).toBeNull();
  });
  it('a PIN must be exactly six digits', () => {
    expect(isPinShape('123456')).toBe(true);
    expect(isPinShape('12345')).toBe(false);
    expect(isPinShape('1234567')).toBe(false);
    expect(isPinShape('12345a')).toBe(false);
    expect(isPinShape('١٢٣٤٥٦')).toBe(false);
  });
});
