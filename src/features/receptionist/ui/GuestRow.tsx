import { View } from 'react-native';

import { viewBooking } from '@/features/receptionist/domain/bookingState';
import { maskPhone } from '@/features/receptionist/domain/guestLists';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { stageLabel } from '@/features/receptionist/ui/stageLabel';
import { stayRange, type IsoDate } from '@/shared/lib/lagosDay';
import { color } from '@/shared/theme';
import { ListRow, StatusPill, Text } from '@/shared/ui';

type Props = {
  booking: BookingRow;
  today: IsoDate;
  onPress: (id: string) => void;
  /** Two-pane only: the row whose detail is open on the right. */
  selected?: boolean;
  testID?: string;
};

export function guestName(b: BookingRow): string {
  return b.guest_name === null || b.guest_name.trim() === '' ? 'Guest' : b.guest_name;
}

export function roomLine(b: BookingRow): string {
  const r = b.hotel_rooms;
  if (r === null) return 'No room yet';
  const type = r.hotel_room_types?.name;
  return type === undefined || type === '' ? `Room ${String(r.room_number)}` : `Room ${String(r.room_number)} · ${type}`;
}

export function nightsLabel(n: number): string {
  return `${String(n)} ${n === 1 ? 'night' : 'nights'}`;
}

// Guest list row (spec §3 Guests): name, room, dates + nights, status pill. Phone masked (R19).
export function GuestRow({ booking, today, onPress, selected = false, testID }: Props) {
  const view = viewBooking(booking, today);
  const status = stageLabel(view.stage);
  const name = guestName(booking);
  const room = roomLine(booking);
  const phone = maskPhone(booking.guest_phone);
  const dates = [
    `${stayRange(booking.check_in_date, booking.check_out_date)} · ${nightsLabel(view.nights)}`,
    phone === '' ? null : phone,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
  const spoken = [name, room, dates, status.label, selected ? 'selected' : null]
    .filter((s): s is string => s !== null)
    .join(', ');
  return (
    <View style={{ backgroundColor: selected ? color.selectedWash : 'transparent' }}>
      <ListRow
        testID={testID}
        title={name}
        subtitle={room}
        note={
          <Text variant="bodySm" tone="textSecondary" numberOfLines={1} tabular>
            {dates}
          </Text>
        }
        trailing={<StatusPill tone={status.tone} label={status.label} size="sm" />}
        accessibilityLabel={spoken}
        onPress={() => {
          onPress(booking.id);
        }}
      />
    </View>
  );
}
