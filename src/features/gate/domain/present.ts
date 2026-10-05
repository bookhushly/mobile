import type { RefusalReason, ScanOutcome, ScannedBy } from './outcome';

export type Tone = 'admitted' | 'used' | 'refused' | 'retry';
export type Cue = 'success' | 'warning' | 'error' | 'retry';
export type Presentation = {
  tone: Tone;
  cue: Cue;
  holdMs: number | null;
  title: string;
  detail: string;
  secondary: string | null;
  action: 'tryAgain' | 'signIn' | 'done' | null;
};

export const HOLD_ADMITTED_MS = 1600;
export const HOLD_USED_MS = 3200;

const REASON: Record<RefusalReason, string> = {
  notFound: 'Ticket not found',
  oldFormat: 'Old ticket format — look this booking up by hand',
  wrongEvent: 'This ticket is for a different event',
  notConfirmed: 'Booking is not confirmed',
  invalid: 'Invalid ticket code',
  notTicket: 'Not a Bookhushly ticket',
  expired: 'Code expired — ask them to refresh their ticket',
  staticNotAllowed: 'Printed QR not accepted — ask for the live ticket',
  notAssigned: "You aren't assigned to this event — call the organiser",
  other: "This ticket can't be admitted",
};

const pad = (n: number) => String(n).padStart(2, '0');

function when(iso: string | null, nowMs: number): string {
  const t = iso === null ? NaN : Date.parse(iso);
  if (!Number.isFinite(t)) return '';
  if (Math.abs(nowMs - t) < 60_000) return 'just now';
  const d = new Date(t);
  return `at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function who(by: ScannedBy, replayed: boolean): string {
  switch (by.kind) {
    case 'me':
      return replayed ? 'on this phone' : 'by you';
    case 'named':
      return `by ${by.name}`;
    case 'anotherScanner':
      return 'by another scanner';
    case 'unknown':
      return '';
  }
}

export function present(o: ScanOutcome, nowMs: number): Presentation {
  switch (o.kind) {
    case 'admitted': {
      const type = o.ticketType ?? 'Ticket';
      const many = o.totalTickets !== null && o.totalTickets > 1;
      return {
        tone: 'admitted',
        cue: 'success',
        holdMs: HOLD_ADMITTED_MS,
        title: 'Admitted',
        detail:
          many && o.ticketIndex !== null
            ? `${type} · ticket ${String(o.ticketIndex)} of ${String(o.totalTickets)}`
            : type,
        secondary:
          many && o.checkedInCount !== null
            ? `${String(o.checkedInCount)} of ${String(o.totalTickets)} on this booking are in`
            : null,
        action: null,
      };
    }
    case 'used': {
      const parts = ['Checked in', when(o.checkedInAt, nowMs), who(o.scannedBy, o.replayed)];
      return {
        tone: 'used',
        cue: 'warning',
        holdMs: HOLD_USED_MS,
        title: 'Already used',
        detail: parts.filter((p) => p !== '').join(' '),
        secondary: null,
        action: null,
      };
    }
    case 'refused':
      return {
        tone: o.fixable ? 'used' : 'refused',
        cue: o.fixable ? 'warning' : 'error',
        holdMs: null,
        title: 'Refused',
        detail: REASON[o.reason],
        secondary: null,
        action: 'done',
      };
    case 'couldntCheck':
      return {
        tone: 'retry',
        cue: 'retry',
        holdMs: null,
        title: "Couldn't check",
        detail:
          o.cause === 'auth'
            ? 'Your session expired — sign in again, then scan again'
            : "We couldn't reach the server — scan again",
        secondary: null,
        action: o.cause === 'auth' ? 'signIn' : 'tryAgain',
      };
  }
}
