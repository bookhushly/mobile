import type { CheckStatus } from '@/features/customer/schemas/checkout';
import type { PayVerdict } from './paymentStatus';

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

export type PayPlan =
  | { do: 'done' }
  | { do: 'open'; reference: string; url: string }
  | { do: 'verifyPending'; reference: string }
  | { do: 'initialize' };

/** Decides Pay from a fresh check-status answer and this device's stored entry, if any. */
export function planPay(check: CheckStatus, stored: StoredPayment | null, nowMs: number): PayPlan {
  if (check.hasPaid) return { do: 'done' };
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

/** After verifying a pending reference we have no URL for (P26). Never initialises on doubt. */
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

export type FlowState =
  | { step: 'review' }
  | { step: 'starting' }
  | { step: 'inBrowser'; reference: string }
  | { step: 'checking'; reference: string; startedAt: number; attempt: number }
  | { step: 'done' }
  | { step: 'failed' }
  | { step: 'stillChecking'; reference: string }
  | { step: 'holdEnded' }
  | { step: 'startError'; words: string }
  | { step: 'pendingElsewhere' };

export type FlowEvent =
  | { type: 'pay' }
  | { type: 'opened'; reference: string }
  | { type: 'returned'; now: number }
  | { type: 'verdict'; verdict: PayVerdict; now: number }
  | { type: 'startFailed'; words: string }
  | { type: 'holdExpired' }
  | { type: 'checkAgain'; now: number }
  | { type: 'paid' }
  | { type: 'pendingElsewhere' };

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
      return state.step === 'starting' ? { step: 'startError', words: ev.words } : state;
    case 'paid':
      return state.step === 'starting' ? { step: 'done' } : state;
    case 'pendingElsewhere':
      return state.step === 'starting' ? { step: 'pendingElsewhere' } : state;
    case 'returned':
      return state.step === 'inBrowser'
        ? { step: 'checking', reference: state.reference, startedAt: ev.now, attempt: 0 }
        : state;
    case 'checkAgain':
      if (state.step === 'stillChecking') {
        return { step: 'checking', reference: state.reference, startedAt: ev.now, attempt: 0 };
      }
      // P26 "Check again" re-runs check-status and the pay plan.
      return state.step === 'pendingElsewhere' ? { step: 'starting' } : state;
    case 'verdict': {
      if (state.step !== 'checking') return state;
      if (ev.verdict === 'paid') return { step: 'done' };
      if (ev.verdict === 'failed') return { step: 'failed' };
      const attempt = state.attempt + 1;
      return nextPollDelay(ev.now - state.startedAt, attempt) === null
        ? { step: 'stillChecking', reference: state.reference }
        : { ...state, attempt };
    }
  }
}
