import {
  dayAt,
  guestsCount,
  joinAddress,
  nightsLabel,
} from '@/features/customer/domain/detailText';
import { fromApartment } from '@/features/customer/domain/myBookings';
import type { ApartmentBookingRow } from '@/features/customer/schemas/bookings';
import { BookingFrame } from '@/features/customer/ui/BookingFrame';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { openMaps } from '@/features/customer/ui/links';
import { daysBetween, stayRange, type IsoDate } from '@/shared/lib/lagosDay';

type Props = {
  row: ApartmentBookingRow;
  today: IsoDate;
  onBack: () => void;
  onRefresh: () => Promise<unknown>;
};

// C12 apartment: area, address (→ Maps), dates and nights, check-in/out times, guests, payment.
export function ApartmentDetails({ row, today, onBack, onRefresh }: Props) {
  const b = fromApartment(row, today);
  const a = row.apartment;
  const address = joinAddress([a?.address, a?.area, a?.city]);
  const nights = row.number_of_nights ?? daysBetween(row.check_in_date, row.check_out_date);
  const dates = stayRange(row.check_in_date, row.check_out_date);
  return (
    <BookingFrame booking={b} onBack={onBack} onRefresh={onRefresh}>
      <DetailRows
        rows={[
          { label: 'Area', value: b.place ?? '' },
          address === null
            ? null
            : {
                label: 'Address',
                value: address,
                onPress: () => {
                  openMaps(address);
                },
              },
          { label: 'Dates', value: nights > 0 ? `${dates} · ${nightsLabel(nights)}` : dates },
          { label: 'Check-in', value: dayAt(row.check_in_date, a?.check_in_time ?? null, 'from') },
          {
            label: 'Check-out',
            value: dayAt(row.check_out_date, a?.check_out_time ?? null, 'by'),
          },
          { label: 'Guests', value: guestsCount(row.number_of_guests) ?? '' },
          { label: 'Payment', value: b.paid ? 'Paid' : 'Not paid', amount: row.total_amount },
        ]}
      />
    </BookingFrame>
  );
}
