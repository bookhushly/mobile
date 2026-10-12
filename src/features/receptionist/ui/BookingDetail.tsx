import { ScrollView, View } from 'react-native';

import type { BookingView } from '@/features/receptionist/domain/bookingState';
import { viewBooking } from '@/features/receptionist/domain/bookingState';
import { useDesk } from '@/features/receptionist/hooks/DeskContext';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { BookingSummary } from '@/features/receptionist/ui/BookingSummary';
import { space } from '@/shared/theme';
import { Button, Stack } from '@/shared/ui';

export type BookingActionHandlers = {
  /** Opens the Choose-room sheet; without it the button is not offered. */
  onChooseRoom?: (booking: BookingRow) => void;
  /** Opens the Check-out sheet; without it the button is not offered. */
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

// The tablet detail pane: the summary scrolls, the actions stay pinned beneath it (the same shape
// as BookingScreen's footer) so Check in / Check out never leave the screen at large text.
export function BookingDetail({ booking, onChooseRoom, onCheckOut, testID }: DetailProps) {
  const { today } = useDesk();
  const view = viewBooking(booking, today);
  return (
    <View style={{ flex: 1 }} testID={testID}>
      <ScrollView
        testID="booking-detail-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: space.s5 }}
        keyboardShouldPersistTaps="handled"
      >
        <BookingSummary booking={booking} view={view} today={today} />
      </ScrollView>
      <View style={{ paddingTop: space.s3 }}>
        <BookingActions
          booking={booking}
          view={view}
          onChooseRoom={onChooseRoom}
          onCheckOut={onCheckOut}
        />
      </View>
    </View>
  );
}
