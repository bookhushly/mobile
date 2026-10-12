import { useState } from 'react';
import { Platform } from 'react-native';

import { useReassign } from '@/features/receptionist/hooks/useReassign';
import { useTicking } from '@/features/receptionist/hooks/useTicking';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import {
  CHOOSE_ROOM_TITLE,
  ChooseRoomBody,
  chooseRoomFooter,
  isReassignBusy,
} from '@/features/receptionist/ui/ChooseRoomPanel';
import { Sheet } from '@/shared/ui';

type Props = {
  /** The booking to move; null keeps the sheet closed. */
  booking: BookingRow | null;
  onClose: () => void;
  /** The move went through: the booking as re-read (or as the server now has it). */
  onMoved: (booking: BookingRow) => void;
  /** "No free rooms" → Open rooms: called once the sheet is out of the way. */
  onOpenRooms?: () => void;
};

type OpenProps = {
  booking: BookingRow;
  visible: boolean;
  onClose: () => void;
  onMoved: (booking: BookingRow) => void;
  onOpenRooms?: () => void;
  onDismissed: () => void;
};

function Open({ booking, visible, onClose, onMoved, onOpenRooms, onDismissed }: OpenProps) {
  const r = useReassign(booking, onMoved);
  const now = useTicking(r.state.step === 'rateLimited' && r.state.untilMs !== null);
  const close = () => {
    r.settle();
    onClose();
  };
  return (
    <Sheet
      visible={visible}
      title={CHOOSE_ROOM_TITLE}
      onClose={close}
      onDismissed={onDismissed}
      closeDisabled={isReassignBusy(r)}
      testID="choose-room-sheet"
      footer={chooseRoomFooter(r, now)}
    >
      <ChooseRoomBody booking={booking} r={r} now={now} onClose={close} onOpenRooms={onOpenRooms} />
    </Sheet>
  );
}

// The Booking screen and the Guests two-pane open the room panel as its own sheet; the check-in
// sheet shows the same panel as a step (iOS can't stack a second Modal on a page sheet).
// Open rooms closes the sheet first; iOS can swallow a navigation made in the same tick as closing
// the RN Modal, so there the sheet stays mounted (hidden) until it has slid away.
export function ChooseRoomSheet({ booking, onClose, onMoved, onOpenRooms }: Props) {
  const [leaving, setLeaving] = useState<BookingRow | null>(null);
  // Reopened before the old one finished leaving: drop the pending navigation.
  if (booking !== null && leaving !== null) setLeaving(null);
  const shown = booking ?? leaving;
  if (shown === null) return null;
  return (
    <Open
      key={shown.id}
      booking={shown}
      visible={booking !== null}
      onClose={onClose}
      onMoved={onMoved}
      onOpenRooms={
        onOpenRooms === undefined
          ? undefined
          : () => {
              if (Platform.OS === 'ios') {
                setLeaving(shown);
                onClose();
                return;
              }
              onClose();
              onOpenRooms();
            }
      }
      onDismissed={() => {
        if (leaving === null) return;
        setLeaving(null);
        onOpenRooms?.();
      }}
    />
  );
}
