import type { EventCodes } from '@/features/customer/schemas/actions';
import type { TicketCodeBody } from '@/features/customer/schemas/ticketCode';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Token = { token: string; expiresAt: number };

export type LiveCodeState =
  | { kind: 'loading' }
  | { kind: 'live'; token: string; expiresAt: number }
  | { kind: 'admitted'; at: string | null }
  | { kind: 'notConfirmed' }
  | { kind: 'notYours' }
  /** Transient (network, timeout, 5xx, bad body): show the C8 fallback, never a refusal. */
  | { kind: 'fallback' }
  /** The session has expired (401): signing in again fixes it, not the connection. */
  | { kind: 'signedOut' }
  | { kind: 'rateLimited'; retryAfterSec: number | null; last: Token | null };

export const REFRESH_AFTER_ERROR_MS = 15_000;
const MIN_REFRESH_MS = 3_000;
const REFRESH_LEAD_MS = 2_000;
// The server accepts the previous step too (±1 × 30 s).
const GRACE_MS = 30_000;

// The route has no error codes: a 409 "already used" carries `checked_in_at`, "not confirmed" doesn't.
function admittedAt(body: unknown): { at: string | null } | null {
  if (typeof body !== 'object' || body === null || !('checked_in_at' in body)) return null;
  const at = body.checked_in_at;
  return { at: typeof at === 'string' ? at : null };
}

export function liveCodeFromResult(
  r: Result<TicketCodeBody, ApiError>,
  last: Token | null,
): LiveCodeState {
  if (r.ok) return { kind: 'live', token: r.value.token, expiresAt: r.value.expires_at };
  const e = r.error;
  switch (e.kind) {
    case 'conflict': {
      const used = admittedAt(e.body);
      return used === null ? { kind: 'notConfirmed' } : { kind: 'admitted', at: used.at };
    }
    case 'forbidden':
    case 'notFound':
      return { kind: 'notYours' };
    case 'rateLimited':
      return { kind: 'rateLimited', retryAfterSec: e.retryAfterSec ?? null, last };
    case 'auth':
      return { kind: 'signedOut' };
    case 'network':
    case 'timeout':
    case 'unavailable':
    case 'validation':
    case 'aborted':
    case 'unknown':
      return { kind: 'fallback' };
  }
}

export function nextRefreshMs(expiresAt: number, serverNow: number): number {
  return Math.max(MIN_REFRESH_MS, expiresAt - serverNow - REFRESH_LEAD_MS);
}

/** Server time from which a token is refused (the step after it has also passed). */
export function usableUntil(expiresAt: number): number {
  return expiresAt + GRACE_MS;
}

export function stillUsable(expiresAt: number, serverNow: number): boolean {
  return serverNow < usableUntil(expiresAt);
}

// ── One poll per booking (spec E2: `GET /api/bookings/event/{id}/codes`) ────────────────────────

type BatchTicket = { token: string | null; checkedInAt: string | null };

/** The booking's codes as last answered: `expiresAt` is null only while none are issued. */
export type LiveBatch = {
  kind: 'live';
  expiresAt: number | null;
  tickets: Readonly<Record<string, BatchTicket>>;
};

export type BookingCodesState =
  | { kind: 'loading' }
  | LiveBatch
  | { kind: 'notConfirmed' }
  | { kind: 'notYours' }
  | { kind: 'fallback' }
  | { kind: 'signedOut' }
  | { kind: 'rateLimited'; retryAfterSec: number | null; last: LiveBatch | null };

/** The route's answers (same checks and codes as the per-ticket route). */
export function codesFromResult(
  r: Result<EventCodes, ApiError>,
  last: LiveBatch | null,
): BookingCodesState {
  if (r.ok) {
    const tickets: Record<string, BatchTicket> = {};
    for (const t of r.value.tickets) tickets[t.id] = { token: t.token, checkedInAt: t.checkedInAt };
    return { kind: 'live', expiresAt: r.value.expiresAt, tickets };
  }
  const e = r.error;
  switch (e.kind) {
    case 'conflict':
      return { kind: 'notConfirmed' };
    case 'forbidden':
    case 'notFound':
      return { kind: 'notYours' };
    case 'rateLimited':
      return { kind: 'rateLimited', retryAfterSec: e.retryAfterSec ?? null, last };
    case 'auth':
      return { kind: 'signedOut' };
    case 'network':
    case 'timeout':
    case 'unavailable':
    case 'validation':
    case 'aborted':
    case 'unknown':
      return { kind: 'fallback' };
  }
}

function ticketOf(b: LiveBatch, ticketId: string): LiveCodeState | Token {
  const t = b.tickets[ticketId];
  if (t === undefined) return { kind: 'fallback' };
  // A used ticket has no token, and that's final (spec E2): "Admitted".
  if (t.token === null) return { kind: 'admitted', at: t.checkedInAt };
  if (b.expiresAt === null) return { kind: 'fallback' };
  return { token: t.token, expiresAt: b.expiresAt };
}

/** One ticket's card state, read out of the booking's codes. */
export function ticketCodeState(s: BookingCodesState, ticketId: string): LiveCodeState {
  switch (s.kind) {
    case 'live': {
      const t = ticketOf(s, ticketId);
      return 'token' in t ? { kind: 'live', token: t.token, expiresAt: t.expiresAt } : t;
    }
    case 'rateLimited': {
      const t = s.last === null ? null : ticketOf(s.last, ticketId);
      if (t !== null && 'kind' in t && t.kind === 'admitted') return t;
      return {
        kind: 'rateLimited',
        retryAfterSec: s.retryAfterSec,
        last: t !== null && 'token' in t ? t : null,
      };
    }
    case 'loading':
    case 'notConfirmed':
    case 'notYours':
    case 'fallback':
    case 'signedOut':
      return s;
  }
}

/** Nothing more to poll: refused for good, or every ticket already used. */
export function codesFinal(s: BookingCodesState): boolean {
  if (s.kind === 'notConfirmed' || s.kind === 'notYours') return true;
  if (s.kind !== 'live') return false;
  const all = Object.values(s.tickets);
  return all.length > 0 && all.every((t) => t.token === null);
}
