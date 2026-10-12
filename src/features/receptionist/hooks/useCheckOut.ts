import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { checkOut } from '@/features/receptionist/api/deskApi';
import { deskDb } from '@/features/receptionist/api/deskDb';
import { deskOutcome, type Refusal } from '@/features/receptionist/domain/deskOutcome';
import { reconcileCheckOut } from '@/features/receptionist/domain/reconcile';
import { deskKeys } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { guestName } from '@/features/receptionist/ui/GuestRow';
import { api, clock } from '@/shared/api/instance';
import { createFeedback } from '@/shared/platform/feedback';

export type CheckOutState =
  | { step: 'confirm'; notDone: boolean } // notDone: a re-read found the guest still in
  | { step: 'sending'; sentAt: number }
  | { step: 'done'; booking: BookingRow }
  | { step: 'refused'; refusal: Refusal }
  | { step: 'uncertain'; sentAt: number }
  | { step: 'rechecking'; sentAt: number }
  | { step: 'rateLimited'; untilMs: number | null }
  | { step: 'elsewhere'; booking: BookingRow };

export type CheckOut = {
  state: CheckOutState;
  confirm: () => void;
  recheck: () => void;
};

const CONFIRM: CheckOutState = { step: 'confirm', notDone: false };

export function checkedOutText(b: BookingRow): string {
  const room = b.hotel_rooms;
  return room === null
    ? 'Checked out'
    : `Checked out · Room ${String(room.room_number)} is now dirty`;
}

// R3 for check-out: one POST per press, never re-posted by itself. A lost answer (or a 409
// "already checked out", which may be our own lost response) is settled by re-reading the booking.
export function useCheckOut(booking: BookingRow): CheckOut {
  const { hotel, signOut } = useDesk();
  const qc = useQueryClient();
  // Not loaded: the desk wants the haptic only, never the gate's sounds.
  const [feedback] = useState(createFeedback);
  const [state, setState] = useState<CheckOutState>(CONFIRM);
  // Set synchronously on press: a second tap before the re-render must not POST again.
  const busy = useRef(false);

  // R11 + R16: log it, one success haptic, and every desk list refetches.
  function finish(b: BookingRow): void {
    const room = booking.hotel_rooms;
    useShiftLog.getState().add({
      at: clock.serverNow(),
      kind: 'checkOut',
      text:
        room === null
          ? `Checked out ${guestName(booking)}`
          : `Checked out ${guestName(booking)} · Room ${String(room.room_number)}`,
    });
    feedback.cue('success');
    void qc.invalidateQueries({ queryKey: deskKeys.all(hotel.id) });
    setState({ step: 'done', booking: b });
  }

  async function reread(sentAt: number): Promise<void> {
    setState({ step: 'rechecking', sentAt });
    const r = await deskDb.bookingById(hotel.id, booking.id);
    if (!r.ok) {
      setState({ step: 'uncertain', sentAt });
      if (r.error.kind === 'auth') signOut();
      return;
    }
    const reconciled = reconcileCheckOut(sentAt, r.value);
    if (reconciled === 'done') finish(r.value ?? booking);
    else if (reconciled === 'elsewhere' && r.value !== null) {
      feedback.cue('warning');
      void qc.invalidateQueries({ queryKey: deskKeys.all(hotel.id) });
      setState({ step: 'elsewhere', booking: r.value });
    } else setState({ step: 'confirm', notDone: true });
  }

  async function confirm(): Promise<void> {
    if (busy.current) return;
    const now = clock.serverNow();
    if (state.step === 'rateLimited') {
      if (state.untilMs !== null && now < state.untilMs) return;
    } else if (state.step !== 'confirm') return;
    busy.current = true;
    const sentAt = now;
    setState({ step: 'sending', sentAt });
    const outcome = deskOutcome('checkOut', await checkOut(api, booking.id));
    switch (outcome.kind) {
      case 'done':
        finish(booking);
        break;
      case 'uncertain':
        setState({ step: 'uncertain', sentAt });
        break;
      case 'rateLimited':
        setState({
          step: 'rateLimited',
          untilMs:
            outcome.retryAfterSec === null
              ? null
              : clock.serverNow() + outcome.retryAfterSec * 1000,
        });
        break;
      case 'refused':
        if (outcome.refusal.kind === 'alreadyOut') await reread(sentAt);
        else {
          feedback.cue('error');
          setState({ step: 'refused', refusal: outcome.refusal });
        }
        break;
      case 'signedOut':
        // The API client only reports a dead session (401 after refresh); the app signs out here.
        setState(CONFIRM);
        signOut();
        break;
    }
    busy.current = false;
  }

  async function recheck(): Promise<void> {
    if (busy.current || state.step !== 'uncertain') return;
    busy.current = true;
    await reread(state.sentAt);
    busy.current = false;
  }

  return {
    state,
    confirm: () => {
      void confirm();
    },
    recheck: () => {
      void recheck();
    },
  };
}
