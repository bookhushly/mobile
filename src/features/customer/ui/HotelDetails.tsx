import { QrCode } from 'lucide-react-native';

import { showCheckInCode } from '@/features/customer/domain/checkInCode';
import { dayAt, guestsLine, joinAddress } from '@/features/customer/domain/detailText';
import { fromHotel } from '@/features/customer/domain/myBookings';
import type { HotelBookingRow } from '@/features/customer/schemas/bookings';
import { BookingFrame } from '@/features/customer/ui/BookingFrame';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { openMaps } from '@/features/customer/ui/links';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { Button } from '@/shared/ui';

type Props = {
  row: HotelBookingRow;
  today: IsoDate;
  onBack: () => void;
  onRefresh: () => Promise<unknown>;
  onShowCheckInCode: (bookingId: string) => void;
};

// C12 hotel: address (→ Maps), check-in/out with the hotel's times, room type, guests, payment.
// No room number: customers can't read rooms.
export function HotelDetails({ row, today, onBack, onRefresh, onShowCheckInCode }: Props) {
  const b = fromHotel(row, today);
  const h = row.hotel;
  const address = joinAddress([h?.address, h?.city, h?.state]);
  return (
    <BookingFrame
      booking={b}
      onBack={onBack}
      onRefresh={onRefresh}
      footer={
        showCheckInCode(row) ? (
          <Button
            label="Show check-in code"
            icon={QrCode}
            onPress={() => {
              onShowCheckInCode(row.id);
            }}
          />
        ) : undefined
      }
    >
      <DetailRows
        rows={[
          address === null
            ? null
            : {
                label: 'Address',
                value: address,
                onPress: () => {
                  openMaps(address);
                },
              },
          { label: 'Check-in', value: dayAt(row.check_in_date, h?.check_in_time ?? null, 'from') },
          {
            label: 'Check-out',
            value: dayAt(row.check_out_date, h?.check_out_time ?? null, 'by'),
          },
          { label: 'Room type', value: row.room_type?.name ?? '' },
          { label: 'Guests', value: guestsLine(row.adults, row.children) ?? '' },
          { label: 'Payment', value: b.paid ? 'Paid' : 'Not paid' },
        ]}
      />
    </BookingFrame>
  );
}
