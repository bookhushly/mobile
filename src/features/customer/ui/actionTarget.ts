import { eventWhen } from '@/features/customer/domain/detailText';
import {
  bookingActions,
  cancelMoneyLine,
  reviewTarget,
  type BookingAction,
  type MoneyLine,
  type ReviewTargetOf,
} from '@/features/customer/domain/bookingActions';
import {
  fromApartment,
  fromEvent,
  fromHotel,
  kindWord,
  type MyBooking,
} from '@/features/customer/domain/myBookings';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import { stayRange, type IsoDate } from '@/shared/lib/lagosDay';

export type ActionTarget =
  | { kind: 'event'; row: EventBookingRow }
  | { kind: 'hotel'; row: HotelBookingRow }
  | { kind: 'apartment'; row: ApartmentBookingRow };

export type ActionFacts = {
  actions: BookingAction[];
  title: string;
  when: string;
  money: MoneyLine;
  paid: boolean;
  /** Event tickets (issued, else the party size); 0 for stays. */
  tickets: number;
  review: ReviewTargetOf | null;
};

function summary(t: ActionTarget, today: IsoDate): MyBooking {
  switch (t.kind) {
    case 'event':
      return fromEvent(t.row, today);
    case 'hotel':
      return fromHotel(t.row, today);
    case 'apartment':
      return fromApartment(t.row, today);
  }
}

/** Everything the Manage booking section and its sheets show for one booking. */
export function actionFacts(t: ActionTarget, today: IsoDate, nowMs: number): ActionFacts {
  const b = summary(t, today);
  const issued = t.kind === 'event' ? (t.row.tickets?.length ?? 0) : 0;
  const tickets = t.kind === 'event' ? (issued > 0 ? issued : (t.row.guests ?? 0)) : 0;
  return {
    actions: bookingActions(t.row, t.kind, today, nowMs),
    title: b.title ?? kindWord(t.kind),
    when: t.kind === 'event' ? eventWhen(b.start, b.end, b.time) : stayRange(b.start, b.end),
    money: cancelMoneyLine(t.row, t.kind),
    paid: b.paid,
    tickets,
    review: reviewTarget(t.row, t.kind),
  };
}
