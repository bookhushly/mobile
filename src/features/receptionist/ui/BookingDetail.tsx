import type { BookingView } from '@/features/receptionist/domain/bookingState';
import { viewBooking } from '@/features/receptionist/domain/bookingState';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { BookingSummary } from '@/features/receptionist/ui/BookingSummary';
import { Button, Stack } from '@/shared/ui';

export type BookingActionHandlers = {
  /** Task 13 wires the Choose-room sheet; without it the button is not offered. */
  onChooseRoom?: (booking: BookingRow) => void;
  /** Task 14 wires the Check-out sheet; without it the button is not offered. */
  onCheckOut?: (booking: BookingRow) => void;
};

type ActionsProps = BookingActionHandlers & { booking: BookingRow; view: BookingView };

// The one place that decides which desk actions a booking offers (spec §3 Booking).
export function BookingActions({ booking, view, onChooseRoom, onCheckOut }: ActionsProps) {
  const { openCheckIn } = useDesk();
  const checkIn = view.actions.includes('checkIn');
  const reassign = view.actions.includes('reassign') && onChooseRoom !== undefined;
  const checkOut = view.actions.includes('checkOut') && onCheckOut !== undefined;
  if (!checkIn && !reassign && !checkOut) return null;
  return (
    <Stack gap="s3">
      {checkIn ? (
        <Button
          label="Check in"
          onPress={() => {
            openCheckIn(booking.check_in_code ?? undefined);
          }}
        />
      ) : null}
      {reassign ? (
        <Button
          variant="secondary"
          label="Choose another room"
          onPress={() => {
            onChooseRoom(booking);
          }}
        />
      ) : null}
      {checkOut ? (
        <Button
          label="Check out"
          onPress={() => {
            onCheckOut(booking);
          }}
        />
      ) : null}
    </Stack>
  );
}

type DetailProps = BookingActionHandlers & { booking: BookingRow; testID?: string };

// Summary + actions in one column: the tablet detail pane. BookingScreen uses the same two parts
// with the actions pinned in the screen footer.
export function BookingDetail({ booking, onChooseRoom, onCheckOut, testID }: DetailProps) {
  const { today } = useDesk();
  const view = viewBooking(booking, today);
  return (
    <Stack gap="s7" testID={testID}>
      <BookingSummary booking={booking} view={view} />
      <BookingActions
        booking={booking}
        view={view}
        onChooseRoom={onChooseRoom}
        onCheckOut={onCheckOut}
      />
    </Stack>
  );
}
