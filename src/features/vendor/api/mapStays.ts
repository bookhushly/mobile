import type { ListingBooking, StayStatus } from '@/features/vendor/domain/listings';

import type { ApiStay } from '@/features/vendor/schemas/vendorApi';

import { isDate } from '@/features/vendor/api/mapWords';

const STAY_STATUS: Record<string, StayStatus> = {
  pending: 'pending',
  confirmed: 'confirmed',
  checked_in: 'checked_in',
  checked_out: 'checked_out',
  completed: 'checked_out',
  cancelled: 'cancelled',
};

/** A hotel or apartment booking from `/api/vendor/bookings`; null for events or unreadable rows. */
export function stayFrom(b: ApiStay): ListingBooking | null {
  if (b.booking_type === 'event') return null;
  const status = STAY_STATUS[b.status ?? ''];
  if (status === undefined || !isDate(b.booking_date) || !isDate(b.check_out_date)) return null;
  const pay = b.payment_status ?? '';
  return {
    id: b.id,
    kind: b.booking_type,
    guest: b.guest_name?.trim() || 'Guest',
    // Hotel bookings don't carry the room type on this route: the hotel's name stands in.
    unit: b.listings?.title ?? (b.booking_type === 'hotel' ? 'Hotel' : 'Apartment'),
    checkIn: b.booking_date,
    checkOut: b.check_out_date,
    guests: b.guests ?? 1,
    total: b.total_amount ?? 0,
    status,
    // The route makes apartment payment up from the status ("completed" only while confirmed), so
    // an apartment is paid once confirmed, checked in or out (BACKEND_STATUS §9).
    payment:
      b.booking_type === 'apartment'
        ? status === 'confirmed' || status === 'checked_in' || status === 'checked_out'
          ? 'paid'
          : 'unpaid'
        : pay === 'completed' || pay === 'paid'
          ? 'paid'
          : pay === 'pay_at_hotel'
            ? 'payAtHotel'
            : 'unpaid',
  };
}
