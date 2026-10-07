import { usedBody, type AdmitBody } from '@/features/gate/schemas/scan';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';
import { parseIsoMs } from '@/shared/lib/isoTime';

export type ScanResponse = Result<AdmitBody, ApiError>;

export type ScannedBy =
  | { kind: 'me' }
  | { kind: 'named'; name: string }
  | { kind: 'anotherScanner' }
  | { kind: 'unknown' };

export type RefusalReason =
  | 'notFound'
  | 'oldFormat'
  | 'wrongEvent'
  | 'notConfirmed'
  | 'invalid'
  | 'notTicket'
  | 'expired'
  | 'staticNotAllowed'
  | 'notAssigned'
  | 'notInList'
  | 'other';

export type CouldntCheckCause =
  | 'network'
  | 'timeout'
  | 'rateLimited'
  | 'server'
  | 'auth'
  | 'unreadable'
  | 'keysOutdated'
  | 'clockChanged'
  | 'offlineUnverifiable'
  | 'noOfflineList';

export type ScanOutcome =
  | {
      kind: 'admitted';
      ticketType: string | null;
      ticketIndex: number | null;
      totalTickets: number | null;
      checkedInCount: number | null;
      checkedInAt: string | null;
      offline?: true;
    }
  | {
      kind: 'used';
      checkedInAt: string | null;
      scannedBy: ScannedBy;
      ticketType: string | null;
      replayed: boolean;
    }
  | { kind: 'refused'; reason: RefusalReason; fixable: boolean; listUpdatedAt?: number }
  | { kind: 'couldntCheck'; cause: CouldntCheckCause };

/** uncertainSince: server-clock ms when an earlier attempt for this code may have committed. */
export type ClassifyContext = { uncertainSince: number | null };

// A check-in this close before our uncertain attempt started is still ours (clock skew).
const BY_ME_SLACK_MS = 5_000;

const refused = (reason: RefusalReason, fixable = false): ScanOutcome => ({
  kind: 'refused',
  reason,
  fixable,
});
const couldnt = (cause: CouldntCheckCause): ScanOutcome => ({ kind: 'couldntCheck', cause });

export const refusedLocally: ScanOutcome = refused('notTicket');

function scannedByFrom(
  raw: string | null,
  at: string | null,
  byMe: boolean | null,
  ctx: ClassifyContext,
): ScannedBy {
  if (byMe === true) return { kind: 'me' };
  // The server's answer wins; the uncertain-attempt heuristic only covers null/absent.
  if (byMe === null && ctx.uncertainSince !== null) {
    const t = parseIsoMs(at) ?? NaN;
    if (!Number.isFinite(t) || t >= ctx.uncertainSince - BY_ME_SLACK_MS) return { kind: 'me' };
  }
  const name = raw?.trim() ?? '';
  if (name === '') return { kind: 'unknown' };
  // The server falls back to the scanner's email; never show another person's email.
  if (name.includes('@')) return { kind: 'anotherScanner' };
  return { kind: 'named', name };
}

function fromConflict(code: string, body: unknown, ctx: ClassifyContext): ScanOutcome {
  switch (code) {
    case 'conflict':
      // The client's default when the 409 had no code: not the scan route speaking.
      return couldnt('server');
    case 'already_checked_in': {
      const p = usedBody.safeParse(body);
      const d = p.success ? p.data : null;
      const at = d?.checked_in_at ?? null;
      return {
        kind: 'used',
        checkedInAt: at,
        scannedBy: scannedByFrom(d?.scanned_by ?? null, at, d?.by_me ?? null, ctx),
        ticketType: d?.ticket?.ticket_type ?? null,
        replayed: false,
      };
    }
    case 'booking_qr':
      return refused('oldFormat');
    case 'wrong_event':
      return refused('wrongEvent');
    case 'not_confirmed':
      return refused('notConfirmed');
    case 'invalid_code':
      return refused('invalid');
    case 'expired_code':
      return refused('expired', true);
    case 'static_not_allowed':
      return refused('staticNotAllowed', true);
    default:
      // A 409 is the server saying no; an unrecognised code is still a refusal.
      return refused('other');
  }
}

export function classify(res: ScanResponse, ctx: ClassifyContext): ScanOutcome {
  if (res.ok) {
    // A 200 is an admission even when the body has drifted; unknown details show as "Ticket".
    const { ticket, booking } = res.value;
    return {
      kind: 'admitted',
      ticketType: ticket?.ticket_type ?? null,
      ticketIndex: ticket?.ticket_index ?? null,
      totalTickets: booking?.total_tickets ?? null,
      checkedInCount: booking?.checked_in_count ?? null,
      checkedInAt: ticket?.checked_in_at ?? null,
    };
  }
  const e = res.error;
  switch (e.kind) {
    case 'conflict':
      return fromConflict(e.code, e.body, ctx);
    // The scan route always sends these codes; a codeless 403/404 is an edge, WAF or older deploy.
    case 'notFound':
      return e.code === 'not_found' ? refused('notFound') : couldnt('server');
    case 'forbidden':
      return e.code === 'forbidden' ? refused('notAssigned') : couldnt('server');
    case 'unknown':
      return e.status === 400 && e.code === 'invalid_code'
        ? refused('invalid')
        : couldnt('unreadable');
    case 'auth':
      return couldnt('auth');
    case 'network':
    case 'aborted':
      return couldnt('network');
    case 'timeout':
      return couldnt('timeout');
    case 'rateLimited':
      return couldnt('rateLimited');
    case 'unavailable':
      return couldnt('server');
    case 'validation':
      return couldnt('unreadable');
  }
}

export function isTransient(res: ScanResponse): boolean {
  if (res.ok) return false;
  switch (res.error.kind) {
    case 'network':
    case 'timeout':
    case 'rateLimited':
    case 'unavailable':
      return true;
    case 'auth':
    case 'forbidden':
    case 'notFound':
    case 'conflict':
    case 'validation':
    case 'aborted':
    case 'unknown':
      return false;
  }
}

/** True when the request may have reached admit_ticket and committed. 429 is refused before the handler. */
export function mayHaveCommitted(res: ScanResponse): boolean {
  if (res.ok) return false;
  switch (res.error.kind) {
    case 'network':
    case 'timeout':
    case 'unavailable':
    case 'validation':
      return true;
    case 'rateLimited':
    case 'auth':
    case 'forbidden':
    case 'notFound':
    case 'conflict':
    case 'aborted':
    case 'unknown':
      return false;
  }
}

/** What a settled code shows when presented again on this phone. */
export function replayOf(settled: ScanOutcome): ScanOutcome {
  switch (settled.kind) {
    case 'admitted':
      return {
        kind: 'used',
        checkedInAt: settled.checkedInAt,
        scannedBy: { kind: 'me' },
        ticketType: settled.ticketType,
        replayed: true,
      };
    case 'used':
      return { ...settled, replayed: true };
    case 'refused':
    case 'couldntCheck':
      return settled;
  }
}
