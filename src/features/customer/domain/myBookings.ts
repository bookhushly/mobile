import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import {
  daysBetween,
  hour12,
  lagosTime,
  shortDate,
  stayRange,
  type IsoDate,
} from '@/shared/lib/lagosDay';

export type BookingKind = 'event' | 'hotel' | 'apartment';
export type ChipTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info';
export type When = 'today' | 'upcoming' | 'past';
export type MyBooking = {
  kind: BookingKind;
  id: string;
  /** null when RLS hides the listing, hotel or apartment (C4). */
  title: string | null;
  place: string | null;
  start: IsoDate;
  /** Events: the same day as `start`. */
  end: IsoDate;
  /** 'HH:MM': event start, or the hotel/apartment check-in time. */
  time: string | null;
  status: string;
  tone: ChipTone;
  paid: boolean;
  /** Unpaid, not cancelled or refunded, and not over yet. */
  pending: boolean;
  when: When;
  next: string;
  imageUrl: string | null;
  createdAt: string | null;
  /** The listing, hotel or apartment booked, when RLS shows it ("Book again", P21). Not kept offline. */
  listingId?: string | null;
};

const PAY_NEXT = 'Finish paying on bookhushly.com';
const PROCESSING_NEXT = 'Payment received — your tickets are on the way';
const HHMM = /^([01]\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/;

// C5 status words and their chip tones.
type Word =
  | 'Pending payment'
  | 'Not paid'
  | 'Processing'
  | 'Confirmed'
  | 'Completed'
  | 'Cancelled'
  | 'Checked in'
  | 'Checked out'
  | 'No-show'
  | 'Refunded';
function toneOf(w: Word): ChipTone {
  switch (w) {
    case 'Confirmed':
      return 'success';
    case 'Pending payment':
      return 'warning';
    case 'Checked in':
    case 'Processing':
      return 'info';
    case 'Not paid':
    case 'Completed':
    case 'Cancelled':
    case 'Checked out':
    case 'No-show':
    case 'Refunded':
      return 'neutral';
  }
}

function hhmm(t: string | null): string | null {
  if (t === null) return null;
  const m = HHMM.exec(t);
  return m === null ? null : `${m[1] ?? ''}:${m[2] ?? ''}`;
}

export function clockLabel(t: string | null): string | null {
  const v = hhmm(t);
  if (v === null) return null;
  return hour12(Number(v.slice(0, 2)), v.slice(3, 5));
}

export function kindWord(k: BookingKind): string {
  switch (k) {
    case 'event':
      return 'Event';
    case 'hotel':
      return 'Hotel stay';
    case 'apartment':
      return 'Apartment stay';
  }
}

function joinPlace(parts: readonly (string | null | undefined)[]): string | null {
  const s = parts.filter((p): p is string => typeof p === 'string' && p.trim() !== '').join(', ');
  return s === '' ? null : s;
}

// Only https images are loaded (no http, file:, data: or other schemes from listing data).
function firstUrl(urls: readonly string[] | null | undefined): string | null {
  return urls?.find((u) => /^https:\/\/[^/]/i.test(u)) ?? null;
}

function withTime(head: string, time: string | null, joiner: string): string {
  const label = clockLabel(time);
  return label === null ? head : `${head}${joiner}${label}`;
}

function byDates(start: IsoDate, end: IsoDate, today: IsoDate): When {
  if (daysBetween(today, end) < 0) return 'past';
  return daysBetween(today, start) <= 0 ? 'today' : 'upcoming';
}

// A booking that was never paid and is over isn't a request to pay (C5 + review ruling).
function settle(word: Word, when: When): Word {
  return word === 'Pending payment' && when === 'past' ? 'Not paid' : word;
}

export function fromEvent(row: EventBookingRow, today: IsoDate): MyBooking {
  const l = row.listing;
  // `event_date` is a `timestamp` ("2026-10-18T00:00:00"); `event_time` a Lagos-meant instant.
  const start = l?.event_date ? l.event_date.slice(0, 10) : row.booking_date;
  // Multi-day events run to `event_end_date`; ignore one before the start.
  const endRaw = l?.event_end_date ? l.event_end_date.slice(0, 10) : start;
  const end = daysBetween(start, endRaw) > 0 ? endRaw : start;
  const fromListing = l?.event_time ? lagosTime(l.event_time) : '';
  const time = fromListing !== '' ? fromListing : hhmm(row.booking_time);

  const paid = row.payment_status === 'completed';
  const base: Word =
    row.status === 'cancelled'
      ? 'Cancelled'
      : row.payment_status === 'refunded'
        ? 'Refunded'
        : row.status === 'completed'
          ? 'Completed'
          : !paid
            ? 'Pending payment'
            : row.status === 'confirmed'
              ? 'Confirmed'
              : // Paid but the booking is still `pending`/null: the webhook hasn't confirmed it yet.
                'Processing';
  const over = base === 'Cancelled' || base === 'Refunded' || base === 'Completed';
  const when: When = over ? 'past' : byDates(start, end, today);
  const word = settle(base, when);
  const pending = word === 'Pending payment';

  let next: string;
  if (word === 'Cancelled') next = 'Cancelled';
  else if (when === 'past') {
    next = (row.tickets ?? []).some((t) => t.checked_in_at !== null)
      ? 'Attended'
      : shortDate(start);
  } else if (pending) next = PAY_NEXT;
  else if (word === 'Processing') next = PROCESSING_NEXT;
  else next = withTime(when === 'today' ? 'Today' : shortDate(start), time, ' · ');

  return {
    kind: 'event',
    id: row.id,
    title: l?.title ?? null,
    place: joinPlace([l?.location]),
    start,
    end,
    time,
    status: word,
    tone: toneOf(word),
    paid,
    pending,
    when,
    next,
    imageUrl: firstUrl(l?.media_urls),
    createdAt: row.created_at,
    listingId: l?.id ?? null,
  };
}

type Stay = {
  kind: 'hotel' | 'apartment';
  id: string;
  title: string | null;
  place: string | null;
  start: IsoDate;
  end: IsoDate;
  checkInTime: string | null;
  imageUrl: string | null;
  createdAt: string | null;
  listingId: string | null;
  paid: boolean;
  /** Booking-level word before the payment rule; null = confirmed-like. */
  terminal: 'Cancelled' | 'Checked out' | 'No-show' | 'Refunded' | null;
  inHouse: boolean;
};

function fromStay(s: Stay, today: IsoDate): MyBooking {
  const base: Word =
    s.terminal ?? (s.inHouse ? 'Checked in' : s.paid ? 'Confirmed' : 'Pending payment');
  // Past once the check-out date has gone, even if the desk never recorded the check-out.
  // An early arrival checked in before its check-in date is still today.
  let when: When;
  if (s.terminal !== null) when = 'past';
  else if (s.inHouse && daysBetween(today, s.end) >= 0) when = 'today';
  else when = byDates(s.start, s.end, today);
  const word = settle(base, when);
  const pending = word === 'Pending payment';

  let next: string;
  if (word === 'Cancelled') next = 'Cancelled';
  else if (word === 'Checked out') next = `Stayed ${stayRange(s.start, s.end)}`;
  else if (when === 'past') next = stayRange(s.start, s.end);
  else if (pending) next = PAY_NEXT;
  else if (s.inHouse) {
    next = daysBetween(today, s.end) <= 0 ? 'Check-out today' : `Check-out ${shortDate(s.end)}`;
  } else {
    const head =
      daysBetween(today, s.start) <= 0 ? 'Check-in today' : `Check-in ${shortDate(s.start)}`;
    next = withTime(head, s.checkInTime, ' from ');
  }

  return {
    kind: s.kind,
    id: s.id,
    title: s.title,
    place: s.place,
    start: s.start,
    end: s.end,
    time: hhmm(s.checkInTime),
    status: word,
    tone: toneOf(word),
    paid: s.paid,
    pending,
    when,
    next,
    imageUrl: s.imageUrl,
    createdAt: s.createdAt,
    listingId: s.listingId,
  };
}

export function fromHotel(row: HotelBookingRow, today: IsoDate): MyBooking {
  const h = row.hotel;
  const st = row.booking_status;
  return fromStay(
    {
      kind: 'hotel',
      id: row.id,
      title: h?.name ?? null,
      place: joinPlace([h?.city, h?.state]),
      start: row.check_in_date,
      end: row.check_out_date,
      checkInTime: h?.check_in_time ?? null,
      imageUrl: firstUrl(h?.image_urls),
      createdAt: row.created_at,
      listingId: h?.id ?? null,
      paid: row.payment_status === 'completed',
      terminal:
        st === 'cancelled'
          ? 'Cancelled'
          : st === 'checked_out' || st === 'completed'
            ? 'Checked out'
            : row.payment_status === 'refunded'
              ? 'Refunded'
              : null,
      // Legacy rows have no status; the receptionist desk reads `checked_in` then.
      inHouse: st === 'checked_in' || (st === null && row.checked_in === true),
    },
    today,
  );
}

export function fromApartment(row: ApartmentBookingRow, today: IsoDate): MyBooking {
  const a = row.apartment;
  const st = row.booking_status;
  const refunded = row.payment_status === 'refunded' || row.payment_status === 'partially_refunded';
  return fromStay(
    {
      kind: 'apartment',
      id: row.id,
      title: a?.name ?? null,
      place: joinPlace([a?.area, a?.city]),
      start: row.check_in_date,
      end: row.check_out_date,
      checkInTime: a?.check_in_time ?? null,
      imageUrl: firstUrl(a?.image_urls),
      createdAt: row.created_at,
      listingId: a?.id ?? null,
      paid: row.payment_status === 'paid',
      terminal:
        st === 'cancelled'
          ? 'Cancelled'
          : st === 'no_show'
            ? 'No-show'
            : st === 'checked_out' || st === 'completed'
              ? 'Checked out'
              : refunded
                ? 'Refunded'
                : null,
      inHouse: st === 'checked_in',
    },
    today,
  );
}

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// Order of creation, either way; a missing created_at always sorts last.
function byCreated(a: string | null, b: string | null, dir: 1 | -1): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  return dir * cmp(a, b);
}

function ascending(a: MyBooking, b: MyBooking): number {
  return (
    cmp(a.start, b.start) ||
    // Untimed sorts after timed on the same day.
    cmp(a.time ?? '99:99', b.time ?? '99:99') ||
    byCreated(a.createdAt, b.createdAt, 1)
  );
}

export function splitBookings(all: readonly MyBooking[]): {
  today: MyBooking[];
  upcoming: MyBooking[];
  past: MyBooking[];
} {
  const today = all.filter((b) => b.when === 'today').sort(ascending);
  const upcoming = all.filter((b) => b.when === 'upcoming').sort(ascending);
  const past = all
    .filter((b) => b.when === 'past')
    .sort((a, b) => cmp(b.start, a.start) || byCreated(a.createdAt, b.createdAt, -1));
  return { today, upcoming, past };
}
