import { QrCode } from 'lucide-react-native';
import type { ReactNode } from 'react';

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
  /** The signed-in customer (the pending-payment banner, P21). */
  userId: string;
  row: HotelBookingRow;
  today: IsoDate;
  onBack: () => void;
  onRefresh: () => Promise<unknown>;
  /** The Manage booking section (spec E9). */
  manage?: ReactNode;
  onShowCheckInCode: (bookingId: string) => void;
};

// C12 hotel: address (→ Maps), check-in/out with the hotel's times, room type, guests, payment.
// No room number: customers can't read rooms.
export function HotelDetails({
  row,
  userId,
  today,
  onBack,
  onRefresh,
  manage,
  onShowCheckInCode,
}: Props) {
  const b = fromHotel(row, today);
  const h = row.hotel;
  const address = joinAddress([h?.address, h?.city, h?.state]);
  return (
    <BookingFrame
      booking={b}
      userId={userId}
      onBack={onBack}
      onRefresh={onRefresh}
      manage={manage}
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
          { label: 'Payment', value: b.paid ? 'Paid' : 'Not paid', amount: row.total_amount },
        ]}
      />
    </BookingFrame>
  );
}
