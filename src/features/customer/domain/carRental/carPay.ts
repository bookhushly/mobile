import {
  PENDING_REINIT_MS,
  REUSE_WINDOW_MS,
  isPaymentUrl,
} from '@/features/customer/domain/checkout/paymentFlow';
import type { CheckStatus } from '@/features/customer/schemas/checkout';

// What Pay does for a chosen car quote. The web reuses an open checkout only for bookings, not
// for car rental (BACKEND_STATUS §9), so the app must never start a second charge while one may
// still be paid: it asks check-status first and decides here.

export type CarPayPlan =
  /** The server has a completed payment: wait for the request to read paid. */
  | { kind: 'paid'; reference: string }
  /** This device opened that same checkout recently: open it again (no new charge). */
  | { kind: 'reopen'; reference: string; url: string }
  /** A payment was started (here or elsewhere) and may still be paid: check it, don't charge. */
  | { kind: 'wait'; reference: string }
  /** An old open payment: verify it first; start a new one only if it isn't clearing. */
  | { kind: 'verifyThenStart'; reference: string }
  | { kind: 'start' }
  /** check-status didn't answer: never start a charge blind. */
  | { kind: 'cantCheck' };

type Stored = { reference: string; url: string; startedAt: number };

export function planCarPay(
  check: CheckStatus | null,
  stored: Stored | null,
  now: number,
): CarPayPlan {
  if (check === null) return { kind: 'cantCheck' };
  if (check.hasPaid) return { kind: 'paid', reference: check.payment.reference };
  if (!check.hasPending) return { kind: 'start' };
  const ref = check.payment.reference;
  if (
    stored !== null &&
    stored.reference === ref &&
    now - stored.startedAt < REUSE_WINDOW_MS &&
    isPaymentUrl(stored.url)
  ) {
    return { kind: 'reopen', reference: ref, url: stored.url };
  }
  const created = Date.parse(check.payment.created_at);
  // An unreadable age counts as recent: on doubt, no second charge.
  if (!Number.isFinite(created) || now - created < PENDING_REINIT_MS) {
    return { kind: 'wait', reference: ref };
  }
  return { kind: 'verifyThenStart', reference: ref };
}
