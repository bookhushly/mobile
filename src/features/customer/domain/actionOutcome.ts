import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type Refusal =
  | 'notCancellable'
  | 'eventPassed'
  | 'checkInPassed'
  | 'bookingChanged'
  | 'forbidden'
  | 'notFound'
  | 'alreadyRequested'
  | 'notRefundable'
  | 'notTransferable'
  | 'alreadyReviewed'
  | 'notEligible'
  | 'invalidCode'
  | 'notCustomer'
  | 'emailUnverified'
  | 'invalid';

export type ActionOutcome<T> =
  | { kind: 'done'; value: T }
  | { kind: 'refused'; reason: Refusal }
  | { kind: 'uncertain' }
  | { kind: 'rateLimited'; retryAfterSec: number | null }
  | { kind: 'signedOut' };

export type ReviewDone = 'posted' | 'alreadyReviewed';

const refused = (reason: Refusal) => ({ kind: 'refused', reason }) as const;

// Machine codes the customer routes send (contract §C, §7a). Anything else falls to the status.
const BY_CODE: ReadonlyMap<string, Refusal> = new Map<string, Refusal>([
  ['not_cancellable', 'notCancellable'],
  ['event_passed', 'eventPassed'],
  ['check_in_passed', 'checkInPassed'],
  ['booking_changed', 'bookingChanged'],
  ['forbidden', 'forbidden'],
  ['not_found', 'notFound'],
  ['already_reviewed', 'alreadyReviewed'],
  ['no_completed_booking', 'notEligible'],
  ['invalid_code', 'invalidCode'],
  ['not_customer', 'notCustomer'],
  ['email_unverified', 'emailUnverified'],
]);

function byCode(code: string | undefined): Refusal | null {
  return code === undefined ? null : (BY_CODE.get(code) ?? null);
}

// What a 4xx without a known code means for one route.
type ByStatus = { badRequest: Refusal; forbidden: Refusal; notFound: Refusal; conflict: Refusal };

const CODED: ByStatus = {
  badRequest: 'invalid',
  forbidden: 'forbidden',
  notFound: 'notFound',
  conflict: 'invalid',
};

// Every answer that isn't a clear server decision is `uncertain` (a POST may or may not have
// landed): network, timeout, abort, 5xx, an unreadable success body, a status we don't know.
function outcome<T>(r: Result<T, ApiError>, status: ByStatus): ActionOutcome<T> {
  if (r.ok) return { kind: 'done', value: r.value };
  const e = r.error;
  switch (e.kind) {
    case 'auth':
      return { kind: 'signedOut' };
    case 'rateLimited':
      return { kind: 'rateLimited', retryAfterSec: e.retryAfterSec ?? null };
    case 'forbidden':
      return refused(byCode(e.code) ?? status.forbidden);
    case 'notFound':
      return refused(byCode(e.code) ?? status.notFound);
    case 'conflict':
      return refused(byCode(e.code) ?? status.conflict);
    case 'unknown':
      if (e.status !== undefined && e.status >= 400 && e.status < 500) {
        return refused(byCode(e.code) ?? status.badRequest);
      }
      return { kind: 'uncertain' };
    case 'network':
    case 'timeout':
    case 'aborted':
    case 'validation':
    case 'unavailable':
      return { kind: 'uncertain' };
  }
}

/** `POST /api/bookings/{kind}/{id}/cancel`: coded (`not_cancellable` is 400 or 409). */
export function cancelOutcome<T>(r: Result<T, ApiError>): ActionOutcome<T> {
  return outcome(r, CODED);
}

/** `POST /api/refunds/request`: no codes, by status. */
export function refundOutcome<T>(r: Result<T, ApiError>): ActionOutcome<T> {
  return outcome(r, {
    badRequest: 'notRefundable',
    forbidden: 'notFound',
    notFound: 'notFound',
    conflict: 'alreadyRequested',
  });
}

/** `POST /api/bookings/event/{id}/transfer`: no codes, by status. */
export function transferOutcome<T>(r: Result<T, ApiError>): ActionOutcome<T> {
  return outcome(r, {
    badRequest: 'notTransferable',
    forbidden: 'notFound',
    notFound: 'notFound',
    conflict: 'invalid',
  });
}

/** `POST /api/reviews/{listingId}`: a 409 `already_reviewed` counts as done. */
export function reviewOutcome<T>(r: Result<T, ApiError>): ActionOutcome<ReviewDone> {
  const o = outcome(r, CODED);
  if (o.kind === 'done') return { kind: 'done', value: 'posted' };
  if (o.kind === 'refused' && o.reason === 'alreadyReviewed') {
    return { kind: 'done', value: 'alreadyReviewed' };
  }
  return o;
}

/** The claim routes (§7a): counts, send code, claim. */
export function claimOutcome<T>(r: Result<T, ApiError>): ActionOutcome<T> {
  return outcome(r, CODED);
}
