import type { CouldntCheckCause, ScanOutcome } from '@/features/gate/domain/outcome';
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
      tag: null,
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
  it('refused holds until Done; fixable refusals are red with an instruction', () => {
    expect(present({ kind: 'refused', reason: 'wrongEvent', fixable: false }, NOW)).toEqual({
      tone: 'refused',
      cue: 'error',
      holdMs: null,
      title: 'Refused',
      detail: 'This ticket is for a different event',
      secondary: null,
      tag: null,
      action: 'done',
    });
    const fixableExpired: ScanOutcome = { kind: 'refused', reason: 'expired', fixable: true };
    expect(present(fixableExpired, NOW)).toMatchObject({
      tone: 'refused',
      cue: 'error',
      holdMs: null,
      title: 'Refused',
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
      tag: null,
      action: 'tryAgain',
    });
    expect(present({ kind: 'couldntCheck', cause: 'auth' }, NOW).action).toBe('signIn');
  });
  it.each<[CouldntCheckCause, string]>([
    ['network', "We couldn't reach the server — scan again"],
    ['timeout', "We couldn't reach the server — scan again"],
    ['rateLimited', 'Too many scans at once — wait a moment, then scan again'],
    ['server', 'The server had a problem — scan again'],
    ['unreadable', 'Unexpected reply from the server — scan again'],
    ['auth', 'Your session expired — sign in again, then scan again'],
  ])("couldn't check copy for %s", (cause, detail) => {
    const p = present({ kind: 'couldntCheck', cause }, NOW);
    expect(p.detail).toBe(detail);
    expect(p.tone).toBe('retry');
  });
  it('offline admission carries the "will sync" tag', () => {
    expect(present({ ...admitted, offline: true }, NOW).tag).toBe('Offline · will sync');
    expect(present(admitted, NOW).tag).toBeNull();
  });
  it('not in offline list says how fresh the list is', () => {
    const p = present(
      { kind: 'refused', reason: 'notInList', fixable: false, listUpdatedAt: NOW - 4 * 60_000 },
      NOW,
    );
    expect(p).toMatchObject({
      tone: 'refused',
      title: 'Refused',
      detail: 'Not in offline list',
      secondary: 'Offline list updated 4 min ago',
      action: 'done',
    });
  });
  it.each<[CouldntCheckCause, string]>([
    [
      'keysOutdated',
      "This phone's ticket keys are out of date — connect to the internet, then scan again",
    ],
    ['clockChanged', "This phone's time changed — connect to the internet once, then scan again"],
    [
      'offlineUnverifiable',
      "Can't check this code offline — ask them to reopen their ticket when online",
    ],
    [
      'noOfflineList',
      "We couldn't reach the server and there's no offline list on this phone — scan again",
    ],
  ])('couldnt check %s: neutral, never red', (cause, detail) => {
    const p = present({ kind: 'couldntCheck', cause }, NOW);
    expect(p).toMatchObject({ tone: 'retry', title: "Couldn't check", detail, action: 'tryAgain' });
  });
  it('reads microsecond timestamps from the roster', () => {
    const p = present(
      {
        kind: 'used',
        checkedInAt: '2026-10-05T17:04:00.123456+00:00',
        scannedBy: { kind: 'me' },
        ticketType: null,
        replayed: false,
      },
      NOW,
    );
    expect(p.detail).toMatch(/^Checked in at \d\d:\d\d by you$/);
  });
  it('lookup and override admissions say how they were made', () => {
    const a = {
      kind: 'admitted',
      ticketType: 'VIP',
      ticketIndex: 1,
      totalTickets: 1,
      checkedInCount: 1,
      checkedInAt: null,
    } as const;
    expect(present({ ...a, offline: true, via: 'lookup' }, NOW).tag).toBe('Lookup · will sync');
    expect(present({ ...a, offline: true, via: 'override' }, NOW).tag).toBe('Override · will sync');
  });
});
