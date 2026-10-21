import type { PaymentState, Verified } from '@/features/customer/schemas/checkout';
import type { ApiError } from '@/shared/lib/errors';

// What a payment answer means for the customer (P14, P15). 'unknown' is for an answer we couldn't
// get (network, 404 or 5xx from status/verify): it is never read as a refusal.
export type PayVerdict = 'paid' | 'failed' | 'pending' | 'unknown';

const TRY_AGAIN = "Couldn't start payment. Try again";
const FAILED_STATUSES: ReadonlySet<string> = new Set(['failed', 'expired', 'abandoned']);

/** `GET /api/payment/status/{ref}`: paid only once the server has also fulfilled the booking. */
export function fromPaymentState(p: PaymentState): PayVerdict {
  const { status, fulfilled } = p.payment;
  if (status === 'completed') return fulfilled ? 'paid' : 'pending';
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

/** Words for a failed `POST /api/payment/initialize` (P14). Anything transient says try again. */
export function startErrorWords(e: ApiError): string {
  if (e.kind === 'conflict' && e.code === 'booking_total_invalid') {
    return "This booking's price couldn't be confirmed. Start again";
  }
  if (e.kind === 'forbidden') return "This booking isn't on your account";
  if (e.kind === 'notFound') return 'Booking not found';
  return TRY_AGAIN;
}
