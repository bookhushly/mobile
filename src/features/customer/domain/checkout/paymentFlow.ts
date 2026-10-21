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

// ── What Pay does (P4, P26) ──────────────────────────────────────────────────────────────────────

/** A stored payment URL older than this is never reopened. */
export const URL_MAX_AGE_MS = 24 * 3600_000;
/** A pending reference this old (with no usable URL) may be replaced by a new initialise. */
export const PENDING_REINIT_MS = 15 * 60_000;

export type StoredPayment = { reference: string; paymentUrl: string; startedAt: number };

// hasPaid is never Done by itself: check-status ignores `fulfilled`, so a paid reference still goes
// through the status poll (`check`), and only its 'paid' verdict ends in Done.
export type PayPlan =
  | { do: 'check'; reference: string }
  | { do: 'open'; reference: string; url: string }
  | { do: 'verifyPending'; reference: string }
  | { do: 'initialize' };

/** Decides Pay from a fresh check-status answer and this device's stored entry, if any. */
export function planPay(check: CheckStatus, stored: StoredPayment | null, nowMs: number): PayPlan {
  if (check.hasPaid) return { do: 'check', reference: check.payment.reference };
  if (!check.hasPending) return { do: 'initialize' };
  const { reference } = check.payment;
  if (
    stored !== null &&
    stored.reference === reference &&
    nowMs - stored.startedAt < URL_MAX_AGE_MS
  ) {
    return { do: 'open', reference, url: stored.paymentUrl };
  }
  return { do: 'verifyPending', reference };
}

/**
 * After verifying a pending reference we have no URL for (P26). Never initialises on doubt.
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
// Checking: on entry (attempt 0) the caller verifies once (P6) and dispatches its answer as a
// `verdict`, with verify's 'paid' sent as 'pending' (verify doesn't report `fulfilled`, P15). That
// verdict moves to attempt 1, so the first status poll (`fromPaymentState`) follows at 3 s, then
// 5, 8, 13 and every 15 s. Each pending/unknown verdict computes the next delay; when there is
// none left the same transition moves to stillChecking, so the caller schedules purely from state
// and can never stall.

export type FlowState =
  | { step: 'review' }
  | { step: 'starting' }
  | { step: 'inBrowser'; reference: string }
  | { step: 'checking'; reference: string; startedAt: number; attempt: number; nextDelayMs: number }
  | { step: 'done' }
  | { step: 'failed' }
  | { step: 'stillChecking'; reference: string }
  | { step: 'holdEnded' }
  | { step: 'startError'; words: string; action: StartErrorAction }
  | { step: 'pendingElsewhere' };

export type FlowEvent =
  | { type: 'pay' }
  | { type: 'opened'; reference: string }
  | { type: 'returned'; now: number }
  | { type: 'verdict'; verdict: PayVerdict; now: number }
  | { type: 'startFailed'; words: string; action: StartErrorAction }
  | { type: 'holdExpired' }
  | { type: 'checkAgain'; now: number }
  | { type: 'paid'; reference: string; now: number }
  | { type: 'pendingElsewhere' }
  | { type: 'retry' };

function startChecking(reference: string, now: number): FlowState {
  return {
    step: 'checking',
    reference,
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
      return state.step === 'starting' ? { step: 'inBrowser', reference: ev.reference } : state;
    case 'startFailed':
      return state.step === 'starting'
        ? { step: 'startError', words: ev.words, action: ev.action }
        : state;
    case 'paid':
      // check-status or verify said paid; Done still waits for a fulfilled status poll.
      return state.step === 'starting' ? startChecking(ev.reference, ev.now) : state;
    case 'pendingElsewhere':
      return state.step === 'starting' ? { step: 'pendingElsewhere' } : state;
    case 'returned':
      return state.step === 'inBrowser' ? startChecking(state.reference, ev.now) : state;
    case 'checkAgain':
      if (state.step === 'stillChecking') return startChecking(state.reference, ev.now);
      // P26 "Check again" re-runs check-status and the pay plan.
      return state.step === 'pendingElsewhere' ? { step: 'starting' } : state;
    case 'retry':
      // Back to Review, which re-runs P4 on the next Pay (P14).
      return state.step === 'failed' ||
        state.step === 'stillChecking' ||
        state.step === 'pendingElsewhere' ||
        state.step === 'startError'
        ? { step: 'review' }
        : state;
    case 'verdict': {
      if (state.step !== 'checking') return state;
      if (ev.verdict === 'paid') return { step: 'done' };
      if (ev.verdict === 'failed') return { step: 'failed' };
      const attempt = state.attempt + 1;
      const nextDelayMs = nextPollDelay(ev.now - state.startedAt, attempt);
      return nextDelayMs === null
        ? { step: 'stillChecking', reference: state.reference }
        : { ...state, attempt, nextDelayMs };
    }
  }
}
