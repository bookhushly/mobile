import {
  decideOffline,
  ticketIdOf,
  type OfflineFacts,
  type RosterTicket,
} from '@/features/gate/domain/offlineDecide';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';

import { BH2_AT, BH2_BAD_SIG, BH2_ID, BH2_KEYS, BH2_TOKEN } from './bh2Vector';

const code = (raw: string): TicketCode => {
  const p = parseTicketCode(raw);
  if (!p) throw new Error(`bad fixture ${raw}`);
  return p.value;
};
const STATIC = code(BH2_ID);
const LISTED_AT = BH2_AT - 4 * 60_000;
const ticket = (over: Partial<RosterTicket> = {}): RosterTicket => ({
  id: BH2_ID,
  ticketType: 'Regular',
  ticketIndex: 1,
  bookingId: '11111111-1111-4111-8111-111111111111',
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  ...over,
});
const facts = (over: Partial<OfflineFacts> = {}): OfflineFacts => ({
  ticket: ticket(),
  isBookingId: false,
  requireDynamic: false,
  keys: BH2_KEYS,
  clockSuspect: false,
  nowMs: BH2_AT,
  listUpdatedAt: LISTED_AT,
  ...over,
});
const outcomeOf = (c: TicketCode, f: OfflineFacts) => {
  const d = decideOffline(c, f);
  return d.kind === 'outcome' ? d.outcome : d;
};

describe('ticketIdOf', () => {
  it('reads the ticket id from BH2, BH1 and static codes', () => {
    expect(ticketIdOf(code(BH2_TOKEN))).toBe(BH2_ID);
    expect(
      ticketIdOf(code('BH1.3f2504e04f8911d39a0c0305e82c3301.abc.0123456789abcdefghijkl')),
    ).toBe(BH2_ID);
    expect(ticketIdOf(STATIC)).toBe(BH2_ID);
    expect(ticketIdOf(code('BH2.garbage'))).toBeNull();
  });
});

describe('decideOffline (spec §4)', () => {
  it('2: a bad signature is refused as invalid', () => {
    expect(outcomeOf(code(BH2_BAD_SIG), facts())).toEqual({
      kind: 'refused',
      reason: 'invalid',
      fixable: false,
    });
  });
  it('3: an unknown kid is couldnt-check, never a refusal', () => {
    expect(outcomeOf(code(BH2_TOKEN), facts({ keys: [] }))).toEqual({
      kind: 'couldntCheck',
      cause: 'keysOutdated',
    });
  });
  it('4: a valid BH2 with a suspect clock is couldnt-check', () => {
    expect(outcomeOf(code(BH2_TOKEN), facts({ clockSuspect: true }))).toEqual({
      kind: 'couldntCheck',
      cause: 'clockChanged',
    });
  });
  it('5: a step outside ±1 is refused as expired (fixable)', () => {
    expect(outcomeOf(code(BH2_TOKEN), facts({ nowMs: BH2_AT + 60_000 }))).toEqual({
      kind: 'refused',
      reason: 'expired',
      fixable: true,
    });
  });
  it('6: BH1 is never admitted offline', () => {
    const bh1 = code('BH1.3f2504e04f8911d39a0c0305e82c3301.abc.0123456789abcdefghijkl');
    expect(outcomeOf(bh1, facts())).toEqual({ kind: 'couldntCheck', cause: 'offlineUnverifiable' });
  });
  it('7: a static code on a live-ticket event is refused (fixable)', () => {
    expect(outcomeOf(STATIC, facts({ requireDynamic: true }))).toEqual({
      kind: 'refused',
      reason: 'staticNotAllowed',
      fixable: true,
    });
  });
  it('7: a BH2 code on a live-ticket event is fine', () => {
    expect(decideOffline(code(BH2_TOKEN), facts({ requireDynamic: true })).kind).toBe('admit');
  });
  it('8: a booking id is the booking-code refusal', () => {
    expect(outcomeOf(STATIC, facts({ ticket: null, isBookingId: true }))).toEqual({
      kind: 'refused',
      reason: 'oldFormat',
      fixable: false,
    });
  });
  it('9: not in the roster carries the list freshness', () => {
    expect(outcomeOf(STATIC, facts({ ticket: null }))).toEqual({
      kind: 'refused',
      reason: 'notInList',
      fixable: false,
      listUpdatedAt: LISTED_AT,
    });
  });
  it.each(['pending', 'cancelled', 'completed'])('10: booking %s is not confirmed', (status) => {
    expect(outcomeOf(STATIC, facts({ ticket: ticket({ bookingStatus: status }) }))).toEqual({
      kind: 'refused',
      reason: 'notConfirmed',
      fixable: false,
    });
  });
  it('11: already admitted shows when and by whom', () => {
    const at = '2026-10-07T18:00:00.000Z';
    expect(
      outcomeOf(
        STATIC,
        facts({ ticket: ticket({ checkedInAt: at, scannedBy: 'Ada', byMe: false }) }),
      ),
    ).toEqual({
      kind: 'used',
      checkedInAt: at,
      scannedBy: { kind: 'named', name: 'Ada' },
      ticketType: 'Regular',
      replayed: false,
    });
    expect(
      outcomeOf(STATIC, facts({ ticket: ticket({ checkedInAt: at, byMe: true }) })),
    ).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });
  it('12: admits with the kid for BH2 and null kid for static', () => {
    expect(decideOffline(code(BH2_TOKEN), facts())).toEqual({
      kind: 'admit',
      ticketId: BH2_ID,
      kid: 't',
    });
    expect(decideOffline(STATIC, facts())).toEqual({ kind: 'admit', ticketId: BH2_ID, kid: null });
  });
  it('the static rules never depend on the clock', () => {
    expect(decideOffline(STATIC, facts({ clockSuspect: true })).kind).toBe('admit');
  });
});
