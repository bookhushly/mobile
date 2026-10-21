import type { ApiError } from '@/shared/lib/errors';
import type { StayProblem } from './selection';

export type CreateOutcome =
  | { kind: 'created' }
  | { kind: 'refused'; words: string; field?: StayProblem }
  /** `freshKey`: the server refused this key for another body; the next send needs a new one. */
  | { kind: 'unsure'; freshKey?: true }
  | { kind: 'wait'; seconds: number }
  | { kind: 'busy'; seconds: number }
  | { kind: 'failed'; words: string; strayBookingId: string | null };

const NOT_AVAILABLE = "This listing isn't available any more";
const SIGN_IN = 'Sign in again to book';
const DEFAULT_BUSY_SECONDS = 2;
const DEFAULT_WAIT_SECONDS = 5;

function refused(words: string, field?: StayProblem): CreateOutcome {
  return field === undefined ? { kind: 'refused', words } : { kind: 'refused', words, field };
}

function field(body: unknown, key: string): unknown {
  return typeof body === 'object' && body !== null && key in body
    ? (body as Record<string, unknown>)[key]
    : undefined;
}

function text(body: unknown, key: string): string | undefined {
  const v = field(body, key);
  return typeof v === 'string' && v.trim() !== '' ? v : undefined;
}

function num(body: unknown, key: string): number | undefined {
  const v = field(body, key);
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

/** Web sends `details` as `{ field: sentence }` (contract check M1); an array is also read. */
function firstDetail(body: unknown): string | undefined {
  const details = field(body, 'details');
  if (Array.isArray(details)) {
    const first: unknown = details[0];
    if (typeof first === 'string' && first.trim() !== '') return first;
    return text(first, 'message');
  }
  if (typeof details !== 'object' || details === null) return undefined;
  return Object.values(details).find((v): v is string => typeof v === 'string' && v.trim() !== '');
}

function busyOrWait(e: ApiError): CreateOutcome | null {
  if (e.kind === 'rateLimited') {
    return { kind: 'wait', seconds: e.retryAfterSec ?? DEFAULT_WAIT_SECONDS };
  }
  if (e.kind === 'conflict' && e.code === 'in_progress') {
    return { kind: 'busy', seconds: num(e.body, 'retry_after') ?? DEFAULT_BUSY_SECONDS };
  }
  // 422 arrives as `unknown` (contract check M3). Never a refusal; the next send gets a new key.
  if ((e.kind === 'unknown' || e.kind === 'conflict') && e.code === 'idempotency_mismatch') {
    return { kind: 'unsure', freshKey: true };
  }
  return null;
}

/** Network, timeout, abort, an unreadable response and other 5xx: never a business refusal. */
function transient(e: ApiError): boolean {
  return (
    e.kind === 'network' ||
    e.kind === 'timeout' ||
    e.kind === 'aborted' ||
    e.kind === 'validation' ||
    e.kind === 'unavailable'
  );
}

function stayCode(e: ApiError, kind: 'hotel' | 'apartment'): CreateOutcome | null {
  const code = e.kind === 'conflict' || e.kind === 'unknown' ? e.code : undefined;
  const body = e.kind === 'conflict' || e.kind === 'unknown' ? e.body : undefined;
  switch (code ?? '') {
    case 'dates_invalid':
      return refused('Choose check-out after check-in, from today', 'dates');
    case 'min_nights': {
      const n = num(body, 'min_nights');
      return refused(
        n === undefined ? 'Choose more nights' : `At least ${String(n)} nights`,
        'minNights',
      );
    }
    case 'max_guests': {
      const n = num(body, 'max_guests');
      return refused(
        n === undefined ? 'Too many guests' : `Up to ${String(n)} guests`,
        'maxGuests',
      );
    }
    case 'unavailable':
      // Hotel 409 also covers `invalid_total` ("can't be booked right now"): the server's words
      // win. Apartment `reason: 'locked'` is another guest mid-checkout (contract check M5).
      if (kind === 'hotel') return refused(text(body, 'error') ?? 'No rooms left for these dates');
      return refused(
        field(body, 'reason') === 'locked'
          ? 'Someone is booking these dates right now. Try again in a few minutes.'
          : 'These dates were just booked. Try other dates',
      );
    case 'not_found':
      return refused(NOT_AVAILABLE);
    case 'invalid_input':
      return refused(firstDetail(body) ?? 'Check your details');
    default:
      return null;
  }
}

export function stayCreateOutcome(e: ApiError, kind: 'hotel' | 'apartment'): CreateOutcome {
  const flow = busyOrWait(e);
  if (flow !== null) return flow;
  if (e.kind === 'auth') return refused(SIGN_IN);
  if (e.kind === 'unavailable' && (e.code === 'booking_failed' || e.code === 'addons_failed')) {
    return {
      kind: 'failed',
      words: "Couldn't book. Try again",
      strayBookingId: text(e.body, 'booking_id') ?? null,
    };
  }
  if (transient(e)) return { kind: 'unsure' };
  if (e.kind === 'notFound') return refused(NOT_AVAILABLE);
  const coded = stayCode(e, kind);
  if (coded !== null) return coded;
  if (e.kind === 'conflict') {
    return refused(text(e.body, 'error') ?? "This can't be booked right now");
  }
  if (e.kind === 'unknown' && e.status === 400) {
    return refused(firstDetail(e.body) ?? 'Check your details');
  }
  if (e.kind === 'forbidden') return refused("This can't be booked right now");
  return { kind: 'unsure' };
}

export function eventCreateOutcome(e: ApiError): CreateOutcome {
  const flow = busyOrWait(e);
  if (flow !== null) return flow;
  if (e.kind === 'auth') return refused(SIGN_IN);
  if (transient(e)) return { kind: 'unsure' };
  if (e.kind === 'notFound') return refused(NOT_AVAILABLE);
  if (e.kind === 'conflict') return refused('Not enough tickets left');
  if (e.kind === 'unknown' && e.status === 400) {
    return refused(text(e.body, 'error') ?? 'Check your tickets');
  }
  if (e.kind === 'forbidden') return refused("This can't be booked right now");
  return { kind: 'unsure' };
}
