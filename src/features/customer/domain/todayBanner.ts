import { showCheckInCode } from '@/features/customer/domain/checkInCode';
import { clockLabel, type MyBooking } from '@/features/customer/domain/myBookings';
import { canShowTickets } from '@/features/customer/domain/tickets';
import type { EventBookingRow, HotelBookingRow } from '@/features/customer/schemas/bookings';

export type BookingAction = 'tickets' | 'checkInCode' | 'open';

/** The fresh rows the door rules read (useMyBookings' rows fit). */
export type ActionRows = {
  events: readonly Pick<EventBookingRow, 'id' | 'payment_status' | 'status' | 'tickets'>[];
  hotels: readonly Pick<
    HotelBookingRow,
    'id' | 'payment_status' | 'booking_status' | 'check_in_code'
  >[];
};

/**
 * A booking's main action at the door. With fresh rows the C6/C10 rules decide; a saved (wallet)
 * entry only carries tickets or a check-in code when those rules allowed them when it was saved.
 */
export function bookingAction(b: MyBooking, rows: ActionRows | null): BookingAction {
  if (rows !== null) {
    if (b.kind === 'event') {
      const r = rows.events.find((e) => e.id === b.id);
      return r !== undefined && canShowTickets(r) === 'show' ? 'tickets' : 'open';
    }
    if (b.kind === 'hotel') {
      const r = rows.hotels.find((h) => h.id === b.id);
      return r !== undefined && showCheckInCode(r) ? 'checkInCode' : 'open';
    }
    return 'open';
  }
  if (b.kind === 'event' && 'tickets' in b && Array.isArray(b.tickets) && b.tickets.length > 0)
    return 'tickets';
  if (
    b.kind === 'hotel' &&
    'checkInCode' in b &&
    typeof b.checkInCode === 'string' &&
    b.checkInCode !== ''
  )
    return 'checkInCode';
  return 'open';
}

export type TodayBanner = {
  booking: MyBooking;
  action: Exclude<BookingAction, 'open'>;
  text: string;
};

function line(b: MyBooking): string {
  const at = clockLabel(b.time);
  if (b.kind === 'event') return at === null ? 'Your event is today' : `Your event starts at ${at}`;
  return at === null ? 'Your stay starts today' : `Check-in today from ${at}`;
}

/**
 * Spec D1: Explore's slim Today banner — the first booking happening today that has something to
 * show at the door (tickets, or a hotel check-in code before check-in), else null. `rows` null =
 * the saved (wallet) copy is showing: its entries carry what may be shown offline.
 */
export function todayBanner(
  today: readonly MyBooking[],
  rows: ActionRows | null,
): TodayBanner | null {
  for (const b of today) {
    if (b.when !== 'today') continue;
    if (b.kind === 'hotel' && b.status === 'Checked in') continue;
    const action = bookingAction(b, rows);
    if (action !== 'open') return { booking: b, action, text: line(b) };
  }
  return null;
}
