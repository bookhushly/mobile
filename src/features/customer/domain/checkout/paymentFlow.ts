import type { CheckStatus } from '@/features/customer/schemas/checkout';
import type { PayVerdict, StartErrorAction } from './paymentStatus';

// ── Polling after the browser closes (P6) ───────────────────────────────────────────────────────

export const POLL_SCHEDULE_MS: readonly number[] = [2000, 3000, 5000, 8000, 13000];
export const POLL_EVERY_MS = 15000;
export const POLL_MAX_MS = 180000;

/** Delay before poll number `attempt` (0-based), or null once it would land after 180 s. */
export function nextPollDelay(elapsedMs: number, attempt: number): number | null {
  const delay = POLL_SCHEDULE_MS[attempt] ?? POLL_EVERY_MS;
  return elapsedMs + delay > POLL_MAX_MS ? null : delay;
}

// ── Hold window (P8): stays are payable until created_at + 25 min, on the server clock ──────────

export const HOLD_MS = 25 * 60_000;

/**
 * When the hold ends (epoch ms), or null for events, which have no hold. An unreadable
 * `created_at` counts as already ended (0): on doubt we don't take money for a stay.
 */
export function holdEndsAt(
  kind: 'hotel' | 'apartment' | 'event',
  createdAtIso: string,
): number | null {
  if (kind === 'event') return null;
  const created = Date.parse(createdAtIso);
  return Number.isFinite(created) ? created + HOLD_MS : 0;
}

// ── The booking row (A2): server truth for Pay and for leave-cancel ─────────────────────────────

export type RowPayState = 'unpaid' | 'paid' | 'cancelled' | 'other';

type RowStatus = {
  status?: string | null;
  payment_status?: string | null;
  booking_status?: string | null;
};

/**
 * What the loaded booking row says (null while loading or not found). Cancelled wins over paid (a
 * refunded cancellation). Paid: event/hotel `payment_status` completed, apartment `paid` (P15).
 */
export function rowPayState(
  kind: 'hotel' | 'apartment' | 'event',
  row: RowStatus | null | undefined,
): RowPayState | null {
  if (row === null || row === undefined) return null;
  const pay = row.payment_status ?? null;
  if (kind === 'event') {
    if (row.status === 'cancelled') return 'cancelled';
    if (pay === 'completed') return 'paid';
    return row.status === 'pending' && pay === 'pending' ? 'unpaid' : 'other';
  }
  if (row.booking_status === 'cancelled') return 'cancelled';
  if (pay === (kind === 'apartment' ? 'paid' : 'completed')) return 'paid';
  return pay === 'pending' ? 'unpaid' : 'other';
}

// ── What Pay does (P4, P26) ──────────────────────────────────────────────────────────────────────

/** A stored payment URL older than this is never reopened. */
export const URL_MAX_AGE_MS = 24 * 3600_000;
/** A pending reference this old (with no usable URL) may be replaced by a new initialise. */
export const PENDING_REINIT_MS = 15 * 60_000;

export type StoredPayment = { reference: string; paymentUrl: string; startedAt: number };

/**
 * A payment started less than 15 min ago (or at an unknown time) may still be in progress: a bank
 * transfer or USSD can take minutes. Such a reference is never verified (web marks Paystack's
 * `ongoing`/`pending` as failed, BACKEND_STATUS §9 (p)) and its failure is never final.
 */
export function isFreshPayment(startedAtMs: number, nowMs: number): boolean {
  return !(nowMs - startedAtMs >= PENDING_REINIT_MS);
}

/**
 * Only Paystack's own pages are opened (security review 6): https, on paystack.com or a
 * subdomain of paystack.com / paystack.co. No userinfo, no other scheme.
 */
export function isPaymentUrl(url: string): boolean {
  const m = /^https:\/\/([a-z0-9.-]+)(?::\d+)?(?:[/?#]|$)/i.exec(url);
  if (m === null) return false;
  const host = (m[1] ?? '').toLowerCase();
  if (host.startsWith('.') || host.includes('..')) return false;
  return host === 'paystack.com' || host.endsWith('.paystack.com') || host.endsWith('.paystack.co');
}

// hasPaid is never Done by itself: check-status ignores `fulfilled`, so a paid reference still goes
// through the status poll (`check`), and only its 'paid' verdict ends in Done.
export type PayPlan =
  | { do: 'check'; reference: string; paymentStartedAt: number }
  | { do: 'open'; reference: string; url: string; paymentStartedAt: number }
  | { do: 'wait' }
  | { do: 'verifyPending'; reference: string }
  | { do: 'initialize' };

/** Decides Pay from a fresh check-status answer and this device's stored entry, if any. */
export function planPay(check: CheckStatus, stored: StoredPayment | null, nowMs: number): PayPlan {
  if (check.hasPaid) {
    return {
      do: 'check',
      reference: check.payment.reference,
      paymentStartedAt: Date.parse(check.payment.created_at),
    };
  }
  if (!check.hasPending) return { do: 'initialize' };
  const { reference } = check.payment;
  if (
    stored !== null &&
    stored.reference === reference &&
    nowMs - stored.startedAt < URL_MAX_AGE_MS &&
    isPaymentUrl(stored.paymentUrl)
  ) {
    return { do: 'open', reference, url: stored.paymentUrl, paymentStartedAt: stored.startedAt };
  }
  // A reference under 15 min old is never verified (A1): wait for it, never initialise.
  if (isFreshPayment(Date.parse(check.payment.created_at), nowMs)) return { do: 'wait' };
  return { do: 'verifyPending', reference };
}

/**
 * After verifying a pending reference we have no URL for (P26; only references ≥ 15 min old are
 * verified). Never initialises on doubt.
 * 'done' comes from verify, which doesn't report `fulfilled`: the caller dispatches `paid`, which
 * moves to Checking, and Done still waits for the status poll.
 */
export function afterPendingVerify(
  v: PayVerdict,
  pendingCreatedAtIso: string,
  nowMs: number,
): 'done' | 'initialize' | 'wait' {
  if (v === 'paid') return 'done';
  if (v === 'failed') return 'initialize';
  const created = Date.parse(pendingCreatedAtIso);
  if (!Number.isFinite(created)) return 'wait';
  return nowMs - created >= PENDING_REINIT_MS ? 'initialize' : 'wait';
}

// ── The flow reducer ─────────────────────────────────────────────────────────────────────────────
//
// Checking polls `GET /api/payment/status/{ref}` only (A1, amended P6): verify is never called
// for a payment the customer may still be making, because web marks a Paystack transfer or USSD in
// progress as failed. The first poll is 2 s after entering Checking (attempt 0), then 3, 5, 8, 13
// and every 15 s. Each pending/unknown verdict computes the next delay; when there is none left
// the same transition moves to stillChecking, so the caller schedules purely from state and can
// never stall. A failed verdict for a payment started under 15 min ago is `unconfirmed`, never
// `failed` (A1b): it may still complete.
//
// `paymentStartedAt` is when the reference was started (server clock; NaN when unknown, which
// counts as fresh).

export type FlowState =
  | { step: 'review' }
  | { step: 'starting' }
  | { step: 'inBrowser'; reference: string; paymentStartedAt: number }
  | {
      step: 'checking';
      reference: string;
      paymentStartedAt: number;
      startedAt: number;
      attempt: number;
      nextDelayMs: number;
    }
  | { step: 'done'; reference: string }
  | { step: 'failed'; reference: string }
  | { step: 'unconfirmed'; reference: string; paymentStartedAt: number }
  | { step: 'stillChecking'; reference: string; paymentStartedAt: number }
  | { step: 'holdEnded' }
  | { step: 'startError'; words: string; action: StartErrorAction }
  | { step: 'pendingElsewhere' };

export type FlowEvent =
  | { type: 'pay' }
  | { type: 'opened'; reference: string; paymentStartedAt: number }
  | { type: 'returned'; now: number }
  | { type: 'verdict'; verdict: PayVerdict; now: number }
  | { type: 'startFailed'; words: string; action: StartErrorAction }
  | { type: 'holdExpired' }
  | { type: 'checkAgain'; now: number }
  | { type: 'paid'; reference: string; paymentStartedAt: number; now: number }
  | { type: 'pendingElsewhere' }
  | { type: 'retry' };

function startChecking(reference: string, paymentStartedAt: number, now: number): FlowState {
  return {
    step: 'checking',
    reference,
    paymentStartedAt,
    startedAt: now,
    attempt: 0,
    nextDelayMs: POLL_SCHEDULE_MS[0] ?? POLL_EVERY_MS,
  };
}

/** Events that don't apply to the current step return the same state object. */
export function flow(state: FlowState, ev: FlowEvent): FlowState {
  switch (ev.type) {
    case 'pay':
      return state.step === 'review' || state.step === 'startError' ? { step: 'starting' } : state;
    case 'holdExpired':
      return state.step === 'review' || state.step === 'startError' ? { step: 'holdEnded' } : state;
    case 'opened':
      return state.step === 'starting'
        ? { step: 'inBrowser', reference: ev.reference, paymentStartedAt: ev.paymentStartedAt }
        : state;
    case 'startFailed':
      return state.step === 'starting'
        ? { step: 'startError', words: ev.words, action: ev.action }
        : state;
    case 'paid':
      // check-status or verify said paid; Done still waits for a fulfilled status poll.
      return state.step === 'starting'
        ? startChecking(ev.reference, ev.paymentStartedAt, ev.now)
        : state;
    case 'pendingElsewhere':
      return state.step === 'starting' ? { step: 'pendingElsewhere' } : state;
    case 'returned':
      return state.step === 'inBrowser'
        ? startChecking(state.reference, state.paymentStartedAt, ev.now)
        : state;
    case 'checkAgain':
      if (state.step === 'stillChecking' || state.step === 'unconfirmed') {
        return startChecking(state.reference, state.paymentStartedAt, ev.now);
      }
      // P26 "Check again" re-runs check-status and the pay plan.
      return state.step === 'pendingElsewhere' ? { step: 'starting' } : state;
    case 'retry':
      // Back to Review, which re-runs P4 only on an explicit Pay tap (P14, A1d).
      return state.step === 'failed' ||
        state.step === 'stillChecking' ||
        state.step === 'pendingElsewhere' ||
        state.step === 'startError'
        ? { step: 'review' }
        : state;
    case 'verdict': {
      if (state.step !== 'checking') return state;
      const { reference, paymentStartedAt } = state;
      if (ev.verdict === 'paid') return { step: 'done', reference };
      if (ev.verdict === 'failed') {
        return isFreshPayment(paymentStartedAt, ev.now)
          ? { step: 'unconfirmed', reference, paymentStartedAt }
          : { step: 'failed', reference };
      }
      const attempt = state.attempt + 1;
      const nextDelayMs = nextPollDelay(ev.now - state.startedAt, attempt);
      return nextDelayMs === null
        ? { step: 'stillChecking', reference, paymentStartedAt }
        : { ...state, attempt, nextDelayMs };
    }
  }
}
