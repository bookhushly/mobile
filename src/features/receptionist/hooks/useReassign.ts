import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';

import { reassignRoom } from '@/features/receptionist/api/deskApi';
import { deskDb } from '@/features/receptionist/api/deskDb';
import { isInHouse } from '@/features/receptionist/domain/bookingState';
import { deskOutcome, type Refusal } from '@/features/receptionist/domain/deskOutcome';
import { reconcileReassign } from '@/features/receptionist/domain/reconcile';
import { reassignCandidates } from '@/features/receptionist/domain/roomBoard';
import { deskKeys } from '@/features/receptionist/hooks/deskKeys';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import { useRooms } from '@/features/receptionist/hooks/useRooms';
import type { BookingRow, RoomRow } from '@/features/receptionist/schemas/desk';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { guestName } from '@/features/receptionist/ui/GuestRow';
import { api, clock } from '@/shared/api/instance';
import { createFeedback } from '@/shared/platform/feedback';

export type ReassignState =
  | { step: 'pick'; taken: RoomRow | null } // a 409 (room just taken) sends the desk back here
  | { step: 'confirm'; room: RoomRow; notDone: boolean } // notDone: a re-read found no move
  | { step: 'sending'; room: RoomRow }
  | { step: 'uncertain'; room: RoomRow }
  | { step: 'rechecking'; room: RoomRow }
  | { step: 'rateLimited'; room: RoomRow; untilMs: number | null }
  | { step: 'refused'; room: RoomRow; refusal: Refusal };

export type Reassign = {
  state: ReassignState;
  candidates: RoomRow[];
  sameTypeId: string | null;
  loading: boolean;
  error: boolean;
  refetchRooms: () => void;
  choose: (room: RoomRow) => void;
  back: () => void;
  move: () => void;
  recheck: () => void;
};

// The server's own post-move state (contract §4) when the re-read is unavailable.
function movedLocally(b: BookingRow, room: RoomRow): BookingRow {
  return {
    ...b,
    hotel_rooms: {
      id: room.id,
      room_number: room.room_number,
      floor: room.floor,
      status: isInHouse(b) ? 'occupied' : 'reserved',
      room_type_id: room.room_type_id,
      hotel_room_types: room.hotel_room_types,
    },
  };
}

// R9: move a booking to a free room. Never idempotent, never re-posted by itself (R3).
export function useReassign(booking: BookingRow, onMoved: (b: BookingRow) => void): Reassign {
  const { hotel } = useDesk();
  const qc = useQueryClient();
  const [feedback] = useState(createFeedback);
  const rooms = useRooms();
  const [state, setState] = useState<ReassignState>({ step: 'pick', taken: null });
  // A result for a request older than the last choose/back is dropped.
  const gen = useRef(0);
  const moved = useRef(onMoved);
  useEffect(() => {
    moved.current = onMoved;
  }, [onMoved]);

  const sameTypeId = booking.hotel_rooms?.room_type_id ?? null;
  const candidates = reassignCandidates(rooms.rooms, {
    typeId: sameTypeId,
    currentRoomId: booking.hotel_rooms?.id ?? null,
  });

  // `row`: the re-read that proved the move (R3), so it is not read twice.
  async function finish(room: RoomRow, row?: BookingRow): Promise<void> {
    useShiftLog.getState().add({
      at: clock.serverNow(),
      kind: 'reassign',
      text: `Moved ${guestName(booking)} to Room ${String(room.room_number)}`,
    });
    feedback.cue('success');
    void qc.invalidateQueries({ queryKey: deskKeys.all(hotel.id) });
    if (row !== undefined) {
      moved.current(row);
      return;
    }
    const r = await deskDb.bookingById(hotel.id, booking.id);
    moved.current(r.ok && r.value !== null ? r.value : movedLocally(booking, room));
  }

  async function move(): Promise<void> {
    if (state.step !== 'confirm' && state.step !== 'rateLimited') return;
    const { room } = state;
    const mine = gen.current;
    setState({ step: 'sending', room });
    const outcome = deskOutcome('reassign', await reassignRoom(api, booking.id, room.id));
    if (mine !== gen.current) return;
    switch (outcome.kind) {
      case 'done':
        await finish(room);
        return;
      case 'uncertain':
        setState({ step: 'uncertain', room });
        return;
      case 'rateLimited':
        setState({
          step: 'rateLimited',
          room,
          untilMs:
            outcome.retryAfterSec === null
              ? null
              : clock.serverNow() + outcome.retryAfterSec * 1000,
        });
        return;
      case 'refused':
        feedback.cue('error');
        if (outcome.refusal.kind === 'roomTaken') {
          setState({ step: 'pick', taken: room });
          void rooms.refetch();
        } else setState({ step: 'refused', room, refusal: outcome.refusal });
        return;
      case 'signedOut':
        // The API client's 401 path has already dropped the session; the layout unmounts us.
        setState({ step: 'pick', taken: null });
        return;
    }
  }

  async function recheck(): Promise<void> {
    if (state.step !== 'uncertain') return;
    const { room } = state;
    const mine = gen.current;
    setState({ step: 'rechecking', room });
    const r = await deskDb.bookingById(hotel.id, booking.id);
    if (mine !== gen.current) return;
    if (!r.ok) {
      setState({ step: 'uncertain', room });
      return;
    }
    if (r.value !== null && reconcileReassign(r.value, room.id) === 'done')
      await finish(room, r.value);
    else setState({ step: 'confirm', room, notDone: true });
  }

  return {
    state,
    candidates,
    sameTypeId,
    loading: rooms.loading,
    error: rooms.error,
    refetchRooms: () => {
      void rooms.refetch();
    },
    choose: (room) => {
      gen.current += 1;
      setState({ step: 'confirm', room, notDone: false });
    },
    back: () => {
      gen.current += 1;
      setState({ step: 'pick', taken: null });
    },
    move: () => {
      void move();
    },
    recheck: () => {
      void recheck();
    },
  };
}
