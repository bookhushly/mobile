import type { PaymentState, Verified } from '@/features/customer/schemas/checkout';
import type { ApiError } from '@/shared/lib/errors';

// What a payment answer means for the customer (P14, P15). 'unknown' is for an answer we couldn't
// get (network, 404 or 5xx from status/verify): it is never read as a refusal.
export type PayVerdict = 'paid' | 'failed' | 'pending' | 'unknown';

const TRY_AGAIN = 'Couldn’t start payment. Try again';
const FAILED_STATUSES: ReadonlySet<string> = new Set(['failed', 'expired', 'abandoned']);

/** `GET /api/payment/status/{ref}`: paid only once the server has also fulfilled the booking. */
export function fromPaymentState(p: PaymentState): PayVerdict {
  const { status, fulfilled } = p.payment;
  // 'success' is a legacy spelling of 'completed'.
  if (status === 'completed' || status === 'success') return fulfilled ? 'paid' : 'pending';
  return FAILED_STATUSES.has(status) ? 'failed' : 'pending';
}

/**
 * `POST /api/payment/verify`. Verify doesn't report `fulfilled`, so its 'paid' is only good for
 * planning (P26); the polling loop's final verdict comes from `fromPaymentState`.
 */
export function fromVerified(v: Verified): PayVerdict {
  if (v.verified && v.status === 'completed') return 'paid';
  if (!v.verified && v.status === 'failed') return 'failed';
  return 'pending';
}

/** The error's machine code, whatever its kind (web #223 codes every initialise error). */
function codeOf(e: ApiError): string | undefined {
  return 'code' in e ? e.code : undefined;
}

/** Coded initialise errors (P14, web #223), keyed by kind and code. */
const CODED_WORDS: ReadonlyMap<string, string> = new Map([
  ['conflict:booking_total_invalid', 'This booking’s price couldn’t be confirmed. Start again'],
  ['conflict:already_paid', 'This booking is already paid.'],
  ['conflict:booking_cancelled', 'This booking has ended. Start again to book.'],
  ['unknown:email_required', 'Add an email to your profile to pay.'],
  // A provider transaction may exist: check-status settles it before any new Pay.
  ['unavailable:record_failed', 'Couldn’t start payment. Check again.'],
]);

/** Words for a failed `POST /api/payment/initialize` (P14). Anything transient says try again. */
export function startErrorWords(e: ApiError): string {
  const coded = CODED_WORDS.get(`${e.kind}:${codeOf(e) ?? ''}`);
  if (coded !== undefined) return coded;
  if (e.kind === 'forbidden') return 'This booking isn’t on your account';
  if (e.kind === 'notFound') return 'Booking not found';
  return TRY_AGAIN;
}

/**
 * What a start error's button does: rebook from Select, run Pay again (check-status first), go to
 * Checking for a booking that is already paid, or nothing (a refusal).
 */
export type StartErrorAction = 'startAgain' | 'tryAgain' | 'checkAgain' | 'paid' | null;

/** The button beside `startErrorWords(e)` (P14). */
export function startErrorAction(e: ApiError): StartErrorAction {
  const code = codeOf(e);
  if (e.kind === 'conflict') {
    if (code === 'booking_total_invalid' || code === 'booking_cancelled') return 'startAgain';
    // Never retried: the caller goes to Checking, or Done when the row reads paid.
    if (code === 'already_paid') return 'paid';
  }
  if (e.kind === 'unknown' && code === 'email_required') return null;
  if (e.kind === 'unavailable' && code === 'record_failed') return 'checkAgain';
  if (e.kind === 'forbidden' || e.kind === 'notFound') return null;
  return 'tryAgain';
}
