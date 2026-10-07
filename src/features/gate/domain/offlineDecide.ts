import { parseBh2, stepInWindow, verifyBh2, type TicketKey } from './bh2';
import type { ScanOutcome, ScannedBy } from './outcome';
import type { TicketCode } from './parseTicketCode';

export type RosterTicket = {
  id: string;
  ticketType: string | null;
  ticketIndex: number | null;
  bookingId: string;
  bookingStatus: string;
  checkedInAt: string | null;
  scannedBy: string | null;
  byMe: boolean | null;
};

export type OfflineFacts = {
  ticket: RosterTicket | null;
  isBookingId: boolean;
  requireDynamic: boolean;
  keys: readonly TicketKey[];
  clockSuspect: boolean;
  /** Offset-corrected (server) clock. */
  nowMs: number;
  /** Server ms the roster was last brought up to date. */
  listUpdatedAt: number;
};

export type OfflineDecision =
  | { kind: 'outcome'; outcome: ScanOutcome }
  | { kind: 'admit'; ticketId: string; kid: string | null };

const HEX32 = /^[0-9a-f]{32}$/i;
const dashed = (h: string) =>
  `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`.toLowerCase();

/** The ticket UUID a code names, without verifying anything (null when it names none). */
export function ticketIdOf(code: TicketCode): string | null {
  if (code.startsWith('BH2.')) return parseBh2(code)?.ticketId ?? null;
  if (code.startsWith('BH1.')) {
    const id = code.split('.')[1] ?? '';
    return HEX32.test(id) ? dashed(id) : null;
  }
  // parseTicketCode already reduced a static code to a lowercase UUID.
  return code;
}

const outcome = (o: ScanOutcome): OfflineDecision => ({ kind: 'outcome', outcome: o });

export function scannedBy(t: RosterTicket): ScannedBy {
  if (t.byMe === true) return { kind: 'me' };
  const name = t.scannedBy?.trim() ?? '';
  return name === '' ? { kind: 'unknown' } : { kind: 'named', name };
}

// Requirements §8.4 / spec 2026-10-07 §4. The first matching rule wins. A code the phone cannot
// verify (BH1, unknown key, untrusted clock) is "couldn't check", never a refusal.
export function decideOffline(code: TicketCode, f: OfflineFacts): OfflineDecision {
  let kid: string | null = null;
  if (code.startsWith('BH1.')) return outcome({ kind: 'couldntCheck', cause: 'offlineUnverifiable' });
  if (code.startsWith('BH2.')) {
    const v = verifyBh2(code, f.keys);
    if (!v.ok) {
      return v.reason === 'unknown_key'
        ? outcome({ kind: 'couldntCheck', cause: 'keysOutdated' })
        : outcome({ kind: 'refused', reason: 'invalid', fixable: false });
    }
    if (f.clockSuspect) return outcome({ kind: 'couldntCheck', cause: 'clockChanged' });
    if (!stepInWindow(v.step, f.nowMs)) {
      return outcome({ kind: 'refused', reason: 'expired', fixable: true });
    }
    kid = v.kid;
  } else if (f.requireDynamic) {
    return outcome({ kind: 'refused', reason: 'staticNotAllowed', fixable: true });
  }

  const t = f.ticket;
  if (t === null) {
    return outcome(
      f.isBookingId
        ? { kind: 'refused', reason: 'oldFormat', fixable: false }
        : { kind: 'refused', reason: 'notInList', fixable: false, listUpdatedAt: f.listUpdatedAt },
    );
  }
  // Only confirmed admits on the server (admit_ticket); completed/pending/cancelled do not.
  if (t.bookingStatus !== 'confirmed') {
    return outcome({ kind: 'refused', reason: 'notConfirmed', fixable: false });
  }
  if (t.checkedInAt !== null) {
    return outcome({
      kind: 'used',
      checkedInAt: t.checkedInAt,
      scannedBy: scannedBy(t),
      ticketType: t.ticketType,
      replayed: false,
    });
  }
  return { kind: 'admit', ticketId: t.id, kid };
}
