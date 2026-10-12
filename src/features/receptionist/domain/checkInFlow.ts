import { parseCheckInCode, type CheckInCode } from '@/features/receptionist/domain/checkInCode';
import type { DeskOutcome, Refusal } from '@/features/receptionist/domain/deskOutcome';
import type { Reconciled } from '@/features/receptionist/domain/reconcile';
import type { BookingRow } from '@/features/receptionist/schemas/desk';

export type FlowState =
  | { step: 'entry'; error: 'empty' | 'shape' | 'eventTicket' | null }
  | { step: 'looking'; code: CheckInCode }
  | { step: 'notFound'; code: CheckInCode }
  | { step: 'lookupFailed'; code: CheckInCode }
  | { step: 'preview'; booking: BookingRow }
  | { step: 'sending'; booking: BookingRow; sentAt: number }
  | { step: 'refused'; booking: BookingRow; refusal: Refusal }
  | { step: 'uncertain'; booking: BookingRow; sentAt: number }
  | { step: 'rechecking'; booking: BookingRow; sentAt: number }
  | { step: 'rateLimited'; booking: BookingRow; untilMs: number | null }
  | { step: 'done'; booking: BookingRow }
  | { step: 'elsewhere'; booking: BookingRow };

export type FlowEvent =
  | { type: 'submit'; raw: string } // typed or scanned
  | { type: 'found'; booking: BookingRow | null }
  | { type: 'lookupError' }
  | { type: 'confirm'; nowMs: number }
  | { type: 'answer'; outcome: DeskOutcome<unknown>; nowMs: number }
  | { type: 'recheck' }
  | { type: 'rechecked'; booking: BookingRow | null; reconciled: Reconciled }
  | { type: 'recheckError' }
  | { type: 'bookingChanged'; booking: BookingRow } // after a reassign
  | { type: 'reset' };

export const initialFlow: FlowState = { step: 'entry', error: null };

function answer(
  s: Extract<FlowState, { step: 'sending' }>,
  outcome: DeskOutcome<unknown>,
  nowMs: number,
): FlowState {
  const { booking, sentAt } = s;
  switch (outcome.kind) {
    case 'done':
      return { step: 'done', booking };
    case 'refused':
      // R3: "already checked in" may be our own lost response; the re-read decides.
      if (outcome.refusal.kind === 'alreadyIn') return { step: 'rechecking', booking, sentAt };
      return { step: 'refused', booking, refusal: outcome.refusal };
    case 'uncertain':
      return { step: 'uncertain', booking, sentAt };
    case 'rateLimited':
      return {
        step: 'rateLimited',
        booking,
        untilMs: outcome.retryAfterSec === null ? null : nowMs + outcome.retryAfterSec * 1000,
      };
    case 'signedOut':
      return s; // the session layer handles it
  }
}

export function checkInFlow(s: FlowState, e: FlowEvent): FlowState {
  switch (e.type) {
    case 'submit': {
      if (s.step !== 'entry' && s.step !== 'notFound' && s.step !== 'lookupFailed') return s;
      const p = parseCheckInCode(e.raw);
      return p.ok ? { step: 'looking', code: p.code } : { step: 'entry', error: p.reason };
    }
    case 'found':
      if (s.step !== 'looking') return s;
      return e.booking === null
        ? { step: 'notFound', code: s.code }
        : { step: 'preview', booking: e.booking };
    case 'lookupError':
      return s.step === 'looking' ? { step: 'lookupFailed', code: s.code } : s;
    case 'confirm':
      if (s.step === 'preview') return { step: 'sending', booking: s.booking, sentAt: e.nowMs };
      if (s.step === 'rateLimited' && (s.untilMs === null || e.nowMs >= s.untilMs)) {
        return { step: 'sending', booking: s.booking, sentAt: e.nowMs };
      }
      return s;
    case 'answer':
      return s.step === 'sending' ? answer(s, e.outcome, e.nowMs) : s;
    case 'recheck':
      return s.step === 'uncertain'
        ? { step: 'rechecking', booking: s.booking, sentAt: s.sentAt }
        : s;
    case 'rechecked': {
      if (s.step !== 'rechecking') return s;
      const booking = e.booking ?? s.booking;
      switch (e.reconciled) {
        case 'done':
          return { step: 'done', booking };
        case 'elsewhere':
          return { step: 'elsewhere', booking };
        case 'notDone':
          return { step: 'preview', booking };
      }
    }
    case 'recheckError':
      return s.step === 'rechecking'
        ? { step: 'uncertain', booking: s.booking, sentAt: s.sentAt }
        : s;
    case 'bookingChanged':
      return s.step === 'preview' || s.step === 'refused'
        ? { step: 'preview', booking: e.booking }
        : s;
    case 'reset':
      return initialFlow;
  }
}
