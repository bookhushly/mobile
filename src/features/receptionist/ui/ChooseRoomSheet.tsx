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
};

function Open({ booking, onClose, onMoved }: Props & { booking: BookingRow }) {
  const r = useReassign(booking, onMoved);
  const now = useTicking(r.state.step === 'rateLimited' && r.state.untilMs !== null);
  return (
    <Sheet
      visible
      title={CHOOSE_ROOM_TITLE}
      onClose={onClose}
      closeDisabled={isReassignBusy(r)}
      testID="choose-room-sheet"
      footer={chooseRoomFooter(r, now)}
    >
      <ChooseRoomBody booking={booking} r={r} now={now} onClose={onClose} />
    </Sheet>
  );
}

// The Booking screen and the Guests two-pane open the room panel as its own sheet; the check-in
// sheet shows the same panel as a step (iOS can't stack a second Modal on a page sheet).
export function ChooseRoomSheet({ booking, onClose, onMoved }: Props) {
  if (booking === null) return null;
  return <Open booking={booking} onClose={onClose} onMoved={onMoved} />;
}
