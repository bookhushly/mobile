import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useReducer, useRef, useState } from 'react';

import { checkIn } from '@/features/receptionist/api/deskApi';
import { deskDb } from '@/features/receptionist/api/deskDb';
import { viewBooking } from '@/features/receptionist/domain/bookingState';
import {
  checkInFlow,
  initialFlow,
  type FlowState,
} from '@/features/receptionist/domain/checkInFlow';
import { deskOutcome, type DeskOutcome } from '@/features/receptionist/domain/deskOutcome';
import { reconcileCheckIn } from '@/features/receptionist/domain/reconcile';
import { deskKeys } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { guestName } from '@/features/receptionist/ui/GuestRow';
import { api, clock } from '@/shared/api/instance';
import { createFeedback, type Feedback } from '@/shared/platform/feedback';

export type CheckInFlow = {
  state: FlowState;
  /** The booking on screen may be checked in (viewBooking says so); the server still decides. */
  canConfirm: boolean;
  submit: (raw: string) => void;
  confirm: () => void;
  recheck: () => void;
  bookingChanged: (booking: BookingRow) => void;
  reset: () => void;
};

export function checkedInText(b: BookingRow): string {
  const room = b.hotel_rooms;
  return room === null ? 'Checked in' : `Checked in · Room ${String(room.room_number)}`;
}

type Done = {
  qc: QueryClient;
  feedback: Feedback;
  hotelId: string;
};

// R11 + R16: log it, one success haptic, and every desk list refetches.
function finished(d: Done, booking: BookingRow): void {
  const room = booking.hotel_rooms;
  useShiftLog.getState().add({
    at: clock.serverNow(),
    kind: 'checkIn',
    text:
      room === null
        ? `Checked in ${guestName(booking)}`
        : `Checked in ${guestName(booking)} · Room ${String(room.room_number)}`,
  });
  d.feedback.cue('success');
  void d.qc.invalidateQueries({ queryKey: deskKeys.all(d.hotelId) });
}

// The check-in state machine (domain/checkInFlow) with its I/O: lookup, one POST per confirm,
// and the R3 re-read. Nothing here re-posts on its own.
export function useCheckIn(onSignedOut: () => void): CheckInFlow {
  const { hotel, today } = useDesk();
  const qc = useQueryClient();
  // Not loaded: the desk wants the haptic only, never the gate's sounds.
  const [feedback] = useState(createFeedback);
  const [state, dispatch] = useReducer(checkInFlow, initialFlow);

  // Latest callback without making it an effect dependency (an inline prop would re-run lookups).
  const signedOut = useRef(onSignedOut);
  useEffect(() => {
    signedOut.current = onSignedOut;
  }, [onSignedOut]);

  const hotelId = hotel.id;

  useEffect(() => {
    if (state.step !== 'looking') return;
    let live = true;
    void deskDb.bookingByCode(hotelId, state.code).then((r) => {
      if (!live) return;
      if (r.ok) {
        dispatch({ type: 'found', booking: r.value });
        return;
      }
      if (r.error.kind === 'auth') signedOut.current();
      dispatch({ type: 'lookupError' });
    });
    return () => {
      live = false;
    };
  }, [state, hotelId]);

  // One request per `sentAt`: React StrictMode (dev) runs effects twice and must not post twice (R3).
  const post = useRef<{ sentAt: number; result: Promise<DeskOutcome<unknown>> } | null>(null);
  useEffect(() => {
    if (state.step !== 'sending') return;
    const { booking, sentAt } = state;
    if (post.current === null || post.current.sentAt !== sentAt) {
      post.current = {
        sentAt,
        result: checkIn(api, booking.id).then((r) => deskOutcome('checkIn', r)),
      };
    }
    let live = true;
    void post.current.result.then((outcome) => {
      if (!live) return;
      if (outcome.kind === 'signedOut') {
        signedOut.current();
        dispatch({ type: 'reset' });
        return;
      }
      if (outcome.kind === 'done') finished({ qc, feedback, hotelId }, booking);
      // "Already checked in" is re-read first (it may be ours); every other refusal is final.
      else if (outcome.kind === 'refused' && outcome.refusal.kind !== 'alreadyIn')
        feedback.cue('error');
      dispatch({ type: 'answer', outcome, nowMs: clock.serverNow() });
    });
    return () => {
      live = false;
    };
  }, [state, qc, feedback, hotelId]);

  useEffect(() => {
    if (state.step !== 'rechecking') return;
    const { booking, sentAt } = state;
    let live = true;
    void deskDb.bookingById(hotelId, booking.id).then((r) => {
      if (!live) return;
      if (!r.ok) {
        if (r.error.kind === 'auth') signedOut.current();
        dispatch({ type: 'recheckError' });
        return;
      }
      const reconciled = reconcileCheckIn(sentAt, r.value);
      if (reconciled === 'done') finished({ qc, feedback, hotelId }, r.value ?? booking);
      else if (reconciled === 'elsewhere') {
        feedback.cue('warning');
        void qc.invalidateQueries({ queryKey: deskKeys.all(hotelId) });
      }
      dispatch({ type: 'rechecked', booking: r.value, reconciled });
    });
    return () => {
      live = false;
    };
  }, [state, qc, feedback, hotelId]);

  const booking = state.step === 'preview' || state.step === 'rateLimited' ? state.booking : null;
  const canConfirm = booking !== null && viewBooking(booking, today).actions.includes('checkIn');

  return {
    state,
    canConfirm,
    submit: (raw) => {
      dispatch({ type: 'submit', raw });
    },
    confirm: () => {
      if (canConfirm) dispatch({ type: 'confirm', nowMs: clock.serverNow() });
    },
    recheck: () => {
      dispatch({ type: 'recheck' });
    },
    bookingChanged: (b) => {
      dispatch({ type: 'bookingChanged', booking: b });
    },
    reset: () => {
      dispatch({ type: 'reset' });
    },
  };
}
