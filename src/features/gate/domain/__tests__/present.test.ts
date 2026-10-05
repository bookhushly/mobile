import type { ScanOutcome } from '@/features/gate/domain/outcome';
import { present } from '@/features/gate/domain/present';

const NOW = Date.parse('2026-10-05T18:05:00.000Z');
const admitted: ScanOutcome = {
  kind: 'admitted',
  ticketType: 'Regular',
  ticketIndex: 2,
  totalTickets: 3,
  checkedInCount: 2,
  checkedInAt: '2026-10-05T18:04:00.000Z',
};

describe('present', () => {
  it('admitted: green, 1.6 s, ticket n of m and booking progress', () => {
    expect(present(admitted, NOW)).toEqual({
      tone: 'admitted',
      cue: 'success',
      holdMs: 1600,
      title: 'Admitted',
      detail: 'Regular · ticket 2 of 3',
      secondary: '2 of 3 on this booking are in',
      action: null,
    });
  });
  it('admitted single ticket: no "of" line', () => {
    const p = present({ ...admitted, ticketIndex: 1, totalTickets: 1, checkedInCount: 1 }, NOW);
    expect(p.detail).toBe('Regular');
    expect(p.secondary).toBeNull();
  });
  it('used by another named scanner: amber, 3.2 s, time and name', () => {
    const p = present(
      {
        kind: 'used',
        checkedInAt: '2026-10-05T17:30:00.000Z',
        scannedBy: { kind: 'named', name: 'Ada Gate' },
        ticketType: 'Regular',
        replayed: false,
      },
      NOW,
    );
    expect(p).toMatchObject({ tone: 'used', cue: 'warning', holdMs: 3200, title: 'Already used' });
    expect(p.detail).toMatch(/^Checked in .* by Ada Gate$/);
  });
  it('used by me just now / replay on this phone', () => {
    const base = { checkedInAt: '2026-10-05T18:04:40.000Z', ticketType: null } as const;
    expect(
      present({ kind: 'used', ...base, scannedBy: { kind: 'me' }, replayed: false }, NOW).detail,
    ).toBe('Checked in just now by you');
    expect(
      present({ kind: 'used', ...base, scannedBy: { kind: 'me' }, replayed: true }, NOW).detail,
    ).toBe('Checked in just now on this phone');
  });
  it('refused holds until Done; fixable refusals are amber', () => {
    expect(present({ kind: 'refused', reason: 'wrongEvent', fixable: false }, NOW)).toEqual({
      tone: 'refused',
      cue: 'error',
      holdMs: null,
      title: 'Refused',
      detail: 'This ticket is for a different event',
      secondary: null,
      action: 'done',
    });
    expect(present({ kind: 'refused', reason: 'expired', fixable: true }, NOW)).toMatchObject({
      tone: 'used',
      cue: 'warning',
      holdMs: null,
      detail: 'Code expired — ask them to refresh their ticket',
    });
  });
  it("couldn't check is neutral, held, and offers try again or sign in", () => {
    expect(present({ kind: 'couldntCheck', cause: 'timeout' }, NOW)).toEqual({
      tone: 'retry',
      cue: 'retry',
      holdMs: null,
      title: "Couldn't check",
      detail: "We couldn't reach the server — scan again",
      secondary: null,
      action: 'tryAgain',
    });
    expect(present({ kind: 'couldntCheck', cause: 'auth' }, NOW).action).toBe('signIn');
  });
});
