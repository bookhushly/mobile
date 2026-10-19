import type { Refusal } from '@/features/customer/domain/actionOutcome';
import type { MoneyLine } from '@/features/customer/domain/bookingActions';
import type { ActionResult } from '@/features/customer/hooks/actionState';
import type { CancelResult } from '@/features/customer/schemas/actions';
import type { StatusTone } from '@/shared/theme';

// Spec E5–E8 wording. Refusals are in words (danger or warning); a lost answer, a rate limit or a
// sign-out is neutral and never reads as a refusal (E10). Raw server text is never shown.

export type Notice = { tone: StatusTone; message: string };

export const NOT_YOURS = 'This booking isn’t on your account.';
const SIGNED_OUT = 'Your session has ended. Sign in again to continue.';

export const MONEY_LINE: Record<MoneyLine, string> = {
  nothingCharged: 'You haven’t paid, so nothing is charged.',
  hotelFullRefund: 'A full refund will be sent to your payment method.',
  refundIfReversible: 'We’ll refund you if the payment can be reversed.',
};

/** The cancel result's refund line: only when the POST answered (a re-read knows nothing). */
export function cancelRefundLine(r: CancelResult | null, paid: boolean): string | null {
  if (r === null || !paid) return null;
  return r.refunded
    ? 'Your refund has been started. It goes back to your payment method.'
    : 'No refund was sent automatically. Contact us on bookhushly.com if you were charged.';
}

// The banner keeps this fixed line; RateLimitWait ticks the seconds beside it (UX review U1).
export const TOO_MANY = 'Too many tries. Wait a moment, then try again.';

type Failed<T> = Exclude<ActionResult<T>, { kind: 'done' }>;

// The parts every action shares; `refusal` gives the action's own words.
function notice<T>(
  o: Failed<T>,
  uncertain: string,
  refusal: (r: Refusal) => Notice,
  notDone = 'Something went wrong. Try again.',
): Notice {
  switch (o.kind) {
    case 'notDone':
      return { tone: 'neutral', message: notDone };
    case 'refused':
      return refusal(o.reason);
    case 'uncertain':
      return { tone: 'neutral', message: uncertain };
    case 'rateLimited':
      return { tone: 'neutral', message: TOO_MANY };
    case 'signedOut':
      return { tone: 'neutral', message: SIGNED_OUT };
  }
}

const danger = (message: string): Notice => ({ tone: 'danger', message });
const warning = (message: string): Notice => ({ tone: 'warning', message });

export const CANCEL_UNSURE = 'We couldn’t confirm whether your booking was cancelled. Check again.';
export const CANCEL_NOT_DONE = 'Couldn’t cancel your booking — try again.';
export const TRANSFER_NOT_DONE = 'Couldn’t send your tickets — try again.';
export const TRANSFER_UNSURE = 'We couldn’t confirm whether your tickets were sent. Check again.';

export function cancelNotice<T>(o: Failed<T>): Notice {
  return notice(
    o,
    CANCEL_UNSURE,
    (r) => {
      if (r === 'eventPassed')
        return danger('This event has already started, so it can’t be cancelled.');
      if (r === 'checkInPassed')
        return danger('Check-in has passed, so this booking can’t be cancelled.');
      if (r === 'bookingChanged')
        return warning('This booking changed — go back and pull to refresh.');
      if (r === 'forbidden' || r === 'notFound') return danger(NOT_YOURS);
      return danger('This booking can’t be cancelled now.');
    },
    CANCEL_NOT_DONE,
  );
}

export const REFUND_ALREADY = 'You’ve already asked for a refund for this booking.';

export function refundNotice<T>(o: Failed<T>): Notice {
  return notice(o, 'We couldn’t send your request. Check your connection and try again.', (r) => {
    if (r === 'alreadyRequested') return { tone: 'success', message: REFUND_ALREADY };
    if (r === 'forbidden' || r === 'notFound') return danger(NOT_YOURS);
    return danger('This booking can’t be refunded now.');
  });
}

export function transferNotice<T>(o: Failed<T>): Notice {
  return notice(
    o,
    TRANSFER_UNSURE,
    (r) => {
      if (r === 'forbidden' || r === 'notFound') return danger(NOT_YOURS);
      if (r === 'invalid') return danger('Check the email address and try again.');
      return danger('These tickets can’t be sent to that address right now.');
    },
    TRANSFER_NOT_DONE,
  );
}

export function reviewNotice<T>(o: Failed<T>): Notice {
  return notice(o, 'We couldn’t post your review. Check your connection and try again.', (r) => {
    if (r === 'notEligible') return warning('You can review after your stay or event.');
    if (r === 'invalid') return danger('Check your rating and comment, then try again.');
    return danger('This review couldn’t be posted.');
  });
}
