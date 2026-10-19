import type { BookingKind } from '@/features/customer/domain/myBookings';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import { daysBetween, type IsoDate } from '@/shared/lib/lagosDay';

export type BookingAction = 'transfer' | 'refund' | 'review' | 'cancel';
/** The cancel sheet's money line (spec E5). */
export type MoneyLine = 'nothingCharged' | 'hotelFullRefund' | 'refundIfReversible';

type AnyRow = EventBookingRow | HotelBookingRow | ApartmentBookingRow;

// The app only offers what the server is likely to allow (spec E5–E8); the server still decides,
// and a refusal at an edge (e.g. Lagos vs UTC midnight) is shown in words.

function asEvent(row: AnyRow, kind: BookingKind): EventBookingRow | null {
  return kind === 'event' && 'listing' in row ? row : null;
}
function asHotel(row: AnyRow, kind: BookingKind): HotelBookingRow | null {
  return kind === 'hotel' && 'hotel' in row ? row : null;
}
function asApartment(row: AnyRow, kind: BookingKind): ApartmentBookingRow | null {
  return kind === 'apartment' && 'apartment' in row ? row : null;
}

function eventStart(row: EventBookingRow): IsoDate {
  const d = row.listing?.event_date;
  return d ? d.slice(0, 10) : row.booking_date;
}

// The server refuses cancel, refund and transfer from the start of the event date, so the event
// day itself offers none of them. A start instant already gone counts as passed too.
function eventStarted(row: EventBookingRow, today: IsoDate, nowMs: number): boolean {
  if (daysBetween(today, eventStart(row)) <= 0) return true;
  const t = row.listing?.event_time ? Date.parse(row.listing.event_time) : NaN;
  return Number.isFinite(t) && t <= nowMs;
}

function eventActions(row: EventBookingRow, today: IsoDate, nowMs: number): BookingAction[] {
  const out: BookingAction[] = [];
  const started = eventStarted(row, today, nowMs);
  const paid = row.payment_status === 'completed';
  if (!started && paid && row.status === 'confirmed') out.push('transfer', 'refund');
  // Review (E8, web `bookingQualifies`): paid, confirmed or completed, event date ≤ today. The
  // listing id is the review target, and the date must come from the listing.
  const date = row.listing?.event_date;
  if (
    paid &&
    (row.status === 'confirmed' || row.status === 'completed') &&
    date &&
    daysBetween(date.slice(0, 10), today) >= 0
  ) {
    out.push('review');
  }
  if (!started && (row.status === 'pending' || row.status === 'confirmed')) out.push('cancel');
  return out;
}

type StayReview = {
  paid: boolean;
  status: string | null;
  checkOut: IsoDate;
  hasListing: boolean;
};

// Web `bookingQualifies` for stays: checked out or completed (contract review K4), or confirmed /
// checked in with check-out ≤ today.
function stayReviewable(s: StayReview, today: IsoDate): boolean {
  if (!s.paid || !s.hasListing) return false;
  if (s.status === 'checked_out' || s.status === 'completed') return true;
  if (s.status === 'confirmed' || s.status === 'checked_in') {
    return daysBetween(s.checkOut, today) >= 0;
  }
  return false;
}

function hotelActions(row: HotelBookingRow, today: IsoDate): BookingAction[] {
  const out: BookingAction[] = [];
  const review = stayReviewable(
    {
      paid: row.payment_status === 'completed',
      status: row.booking_status,
      checkOut: row.check_out_date,
      hasListing: row.hotel !== null,
    },
    today,
  );
  if (review) out.push('review');
  const closed =
    row.booking_status === 'cancelled' ||
    row.booking_status === 'checked_in' ||
    row.booking_status === 'checked_out' ||
    row.booking_status === 'completed' ||
    row.checked_in === true ||
    row.checked_in_at !== null;
  if (!closed && daysBetween(today, row.check_in_date) > 0) out.push('cancel');
  return out;
}

function apartmentActions(row: ApartmentBookingRow, today: IsoDate): BookingAction[] {
  const out: BookingAction[] = [];
  const review = stayReviewable(
    {
      paid: row.payment_status === 'paid',
      status: row.booking_status,
      checkOut: row.check_out_date,
      hasListing: row.apartment !== null,
    },
    today,
  );
  if (review) out.push('review');
  // E5 plus guards the server lacks (§9 Customer 5(a): no date check): a no-show, or a stay
  // that has already started, is not offered — cancelling it would refund a used stay. A
  // part-refunded stay isn't either: the server won't refund the rest, and "Nothing is charged"
  // would be untrue for money already kept.
  const closed =
    row.payment_status === 'partially_refunded' ||
    row.booking_status === 'cancelled' ||
    row.booking_status === 'checked_in' ||
    row.booking_status === 'checked_out' ||
    row.booking_status === 'completed' ||
    row.booking_status === 'no_show' ||
    row.checked_in_at !== null;
  if (!closed && daysBetween(today, row.check_in_date) > 0) out.push('cancel');
  return out;
}

/** Actions to offer on a booking, in display order: transfer, refund, review, cancel. */
export function bookingActions(
  row: AnyRow,
  kind: BookingKind,
  today: IsoDate,
  nowMs: number,
): BookingAction[] {
  const e = asEvent(row, kind);
  if (e) return eventActions(e, today, nowMs);
  const h = asHotel(row, kind);
  if (h) return hotelActions(h, today);
  const a = asApartment(row, kind);
  if (a) return apartmentActions(a, today);
  return [];
}

/** What cancelling does to the money: the server refunds only `completed` / `paid` bookings. */
export function cancelMoneyLine(row: AnyRow, kind: BookingKind): MoneyLine {
  const paid = row.payment_status === 'completed' || row.payment_status === 'paid';
  if (!paid) return 'nothingCharged';
  return kind === 'hotel' ? 'hotelFullRefund' : 'refundIfReversible';
}

/** What a review is posted on (spec E8): the booking's listing, when RLS still shows it. */
export type ReviewTargetOf = { listingId: string; type: BookingKind };

export function reviewTarget(row: AnyRow, kind: BookingKind): ReviewTargetOf | null {
  const e = asEvent(row, kind);
  if (e) return e.listing === null ? null : { listingId: e.listing.id, type: 'event' };
  const h = asHotel(row, kind);
  if (h) return h.hotel === null ? null : { listingId: h.hotel.id, type: 'hotel' };
  const a = asApartment(row, kind);
  if (a) return a.apartment === null ? null : { listingId: a.apartment.id, type: 'apartment' };
  return null;
}
