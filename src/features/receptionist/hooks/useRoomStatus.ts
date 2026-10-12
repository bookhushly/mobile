import { useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';

import { setRoomStatus } from '@/features/receptionist/api/deskApi';
import { deskDb } from '@/features/receptionist/api/deskDb';
import { deskOutcome } from '@/features/receptionist/domain/deskOutcome';
import type { SettableStatus } from '@/features/receptionist/domain/roomBoard';
import { deskKeys } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import type { RoomRow } from '@/features/receptionist/schemas/desk';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { refusalText, type RefusalCopy } from '@/features/receptionist/ui/refusalText';
import { roomTitle, statusPhrase } from '@/features/receptionist/ui/roomTone';
import { api, clock } from '@/shared/api/instance';
import { createFeedback } from '@/shared/platform/feedback';

export type RoomStatusState =
  | { step: 'idle' }
  | { step: 'sending' }
  // Transient: neutral words, and **Try again** may re-send (the PATCH is idempotent).
  | { step: 'retry'; message: string }
  | { step: 'refused'; message: string; tone: RefusalCopy['tone'] }
  | { step: 'rateLimited'; untilMs: number | null };

export type RoomStatusChange = {
  state: RoomStatusState;
  save: (status: SettableStatus) => void;
};

const UNCERTAIN = "Couldn't confirm. Check the board and try again.";
const RETRY_403 = "Couldn't save. Try again.";

// R18: set a room's status. The route carries no codes: 409 → occupied, 404 → gone, and a 403
// may be a transient DB read on the server, so the staff row is re-read once before refusing.
export function useRoomStatus(room: RoomRow, onSaved: () => void): RoomStatusChange {
  const { hotel, userId, signOut } = useDesk();
  const qc = useQueryClient();
  const [feedback] = useState(createFeedback);
  const [state, setState] = useState<RoomStatusState>({ step: 'idle' });
  // Set synchronously on press: a second tap before the re-render must not PATCH again.
  const busy = useRef(false);

  const refetchRooms = () => {
    void qc.invalidateQueries({ queryKey: deskKeys.rooms(hotel.id) }, { cancelRefetch: false });
  };
  const refuse = (copy: { message: string; tone: RefusalCopy['tone'] }) => {
    feedback.cue('error');
    setState({ step: 'refused', ...copy });
  };

  // Still on this hotel's staff → the 403 was transient; gone → a real refusal.
  async function forbidden(): Promise<void> {
    const r = await deskDb.staffHotels(userId);
    if (!r.ok) {
      if (r.error.kind === 'auth') signOut();
      setState({ step: 'retry', message: RETRY_403 });
      return;
    }
    if (r.value.some((row) => row.hotel_id === hotel.id)) {
      setState({ step: 'retry', message: RETRY_403 });
      return;
    }
    refuse(refusalText({ kind: 'forbidden' }, { act: 'roomStatus' }));
  }

  async function save(status: SettableStatus): Promise<void> {
    if (busy.current || state.step === 'sending' || state.step === 'refused') return;
    if (state.step === 'rateLimited' && state.untilMs !== null && clock.serverNow() < state.untilMs)
      return;
    busy.current = true;
    setState({ step: 'sending' });
    const outcome = deskOutcome('roomStatus', await setRoomStatus(api, room.id, status));
    switch (outcome.kind) {
      case 'done':
        useShiftLog.getState().add({
          at: clock.serverNow(),
          kind: 'roomStatus',
          text: `${roomTitle(room)} marked ${statusPhrase(status)}`,
        });
        feedback.cue('success');
        void qc.invalidateQueries({ queryKey: deskKeys.all(hotel.id) }, { cancelRefetch: false });
        setState({ step: 'idle' });
        onSaved();
        break;
      case 'uncertain':
        setState({ step: 'retry', message: UNCERTAIN });
        refetchRooms();
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
      case 'refused': {
        const { refusal } = outcome;
        if (refusal.kind === 'forbidden') await forbidden();
        else if (refusal.kind === 'roomOccupied') {
          refuse({ message: 'A guest was just checked in to this room.', tone: 'warning' });
          refetchRooms();
        } else {
          refuse(refusalText(refusal, { act: 'roomStatus' }));
          if (refusal.kind === 'notFound') refetchRooms();
        }
        break;
      }
      case 'signedOut':
        // The API client only reports a dead session (401 after refresh); the app signs out here.
        setState({ step: 'idle' });
        signOut();
        break;
    }
    busy.current = false;
  }

  return {
    state,
    save: (status) => {
      void save(status);
    },
  };
}
