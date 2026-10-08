import { parseBh2, stepAt, stepInWindow, verifyBh2 } from '@/features/gate/domain/bh2';

import { BH2_AT, BH2_BAD_SIG, BH2_ID, BH2_KEYS, BH2_TOKEN } from './bh2Vector';

const swapPart = (i: number, value: string) => {
  const p = BH2_TOKEN.split('.');
  p[i] = value;
  return p.join('.');
};

describe('BH2', () => {
  it('verifies the web-signed vector', () => {
    expect(verifyBh2(BH2_TOKEN, BH2_KEYS)).toEqual({
      ok: true,
      ticketId: BH2_ID,
      kid: 't',
      step: stepAt(BH2_AT),
    });
  });
  it('parses the ticket id without verifying', () => {
    expect(parseBh2(BH2_TOKEN)?.ticketId).toBe(BH2_ID);
  });
  it('a flipped signature byte is a bad signature', () => {
    expect(verifyBh2(BH2_BAD_SIG, BH2_KEYS)).toEqual({ ok: false, reason: 'bad_signature' });
  });
  it('a tampered ticket id or step is a bad signature', () => {
    expect(verifyBh2(swapPart(2, 'QyUE4E-JEdOaDAMF6CwzAQ'), BH2_KEYS)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
    expect(verifyBh2(swapPart(3, 'xqka3'), BH2_KEYS)).toEqual({
      ok: false,
      reason: 'bad_signature',
    });
  });
  it('an unpublished kid, or a broken published key, is unknown_key', () => {
    expect(verifyBh2(BH2_TOKEN, [])).toEqual({ ok: false, reason: 'unknown_key' });
    expect(verifyBh2(BH2_TOKEN, [{ kid: 'u', publicKey: BH2_KEYS[0]?.publicKey ?? '' }])).toEqual({
      ok: false,
      reason: 'unknown_key',
    });
    expect(verifyBh2(BH2_TOKEN, [{ kid: 't', publicKey: 'nope' }])).toEqual({
      ok: false,
      reason: 'unknown_key',
    });
  });
  it.each([
    ['wrong prefix', BH2_TOKEN.replace('BH2.', 'BH3.')],
    ['four parts', BH2_TOKEN.split('.').slice(0, 4).join('.')],
    ['uppercase kid', swapPart(1, 'T')],
    ['leading-zero step', swapPart(3, '0xqka2')],
    ['short id', swapPart(2, 'PyUE4E-JEdOaDAMF6CwzA')],
    ['non-canonical signature tail', BH2_TOKEN.slice(0, -1) + 'x'],
  ])('%s is malformed', (_name, token) => {
    expect(verifyBh2(token, BH2_KEYS)).toEqual({ ok: false, reason: 'malformed' });
  });
  it('accepts the current step ±1 and nothing wider', () => {
    const s = stepAt(BH2_AT);
    expect(stepInWindow(s, BH2_AT)).toBe(true);
    expect(stepInWindow(s, BH2_AT + 30_000)).toBe(true);
    expect(stepInWindow(s, BH2_AT - 30_000)).toBe(true);
    expect(stepInWindow(s, BH2_AT + 60_000)).toBe(false);
    expect(stepInWindow(s, BH2_AT - 60_000)).toBe(false);
  });
});
