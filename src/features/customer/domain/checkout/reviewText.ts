import {
  eventWhen,
  guestsCount,
  guestsLine,
  nightsLabel,
  packagesLine,
} from '@/features/customer/domain/detailText';
import { fromEvent } from '@/features/customer/domain/myBookings';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import type { ServiceCharge } from '@/features/customer/schemas/checkout';
import { daysBetween, isIsoDate, shortDate, stayRange, type IsoDate } from '@/shared/lib/lagosDay';

// Spec §5, P20, P28: the words and numbers on Review and Done. Server numbers only.

export type ReviewKind = 'hotel' | 'apartment' | 'event';
export type BookingRow = EventBookingRow | HotelBookingRow | ApartmentBookingRow;

/** What Review needs from the cached checkout entry (P28). */
export type SummaryEntry = {
  title: string;
  summary: {
    checkIn?: string;
    checkOut?: string;
    guests?: number;
    roomName?: string;
    eventDate?: string;
    tickets?: number;
  };
};

export type ReviewSummary = { title: string; when: string; extra: string | null };

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The service charge estimate; initialise computes the real one. Null when there is none. */
export function chargeEstimate(
  total: number,
  charge: ServiceCharge['charge'],
): { label: string; amount: number } | null {
  if (charge === null || !charge.enabled) return null;
  const amount =
    charge.charge_type === 'percentage'
      ? round2((total * charge.charge_value) / 100)
      : charge.charge_value;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  const label =
    charge.label !== null && charge.label.trim() !== '' ? charge.label : 'Service charge';
  return { label, amount };
}

export type PriceLine = { label: string; amount: number };

const positive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/**
 * The cached breakdown as lines, or null for the total-only layout (P28). Hotel discounts are
 * already inside `room_total`, so they are a note, never a minus line. An apartment discount is
 * recorded but not subtracted by the server, so it is never shown.
 */
export function priceLines(
  kind: ReviewKind,
  pricing: Readonly<Record<string, number | null>> | null,
): { lines: PriceLine[]; discountIncluded: number | null } | null {
  if (pricing === null || kind === 'event') return null;
  const main = kind === 'hotel' ? pricing.room_total : pricing.subtotal;
  if (typeof main !== 'number' || !Number.isFinite(main)) return null;
  const extras: [string, number | null | undefined][] =
    kind === 'hotel'
      ? [
          ['Breakfast', pricing.breakfast_total],
          ['Airport transfer', pricing.airport_fee],
        ]
      : [
          ['Service fee', pricing.service_fee],
          ['Caution deposit', pricing.caution_deposit],
          ['Airport transfer', pricing.airport_fee],
        ];
  const lines: PriceLine[] = [{ label: kind === 'hotel' ? 'Room' : 'Stay', amount: main }];
  for (const [label, amount] of extras) if (positive(amount)) lines.push({ label, amount });
  const discount = pricing.discount_amount;
  return { lines, discountIncluded: kind === 'hotel' && positive(discount) ? discount : null };
}

function stayWhen(from: string | undefined, to: string | undefined): string {
  if (from === undefined || to === undefined || !isIsoDate(from) || !isIsoDate(to)) return '';
  return `${stayRange(from, to)} · ${nightsLabel(daysBetween(from, to))}`;
}

const join = (parts: readonly (string | null | undefined)[]): string | null => {
  const s = parts.filter((p): p is string => typeof p === 'string' && p !== '').join(' · ');
  return s === '' ? null : s;
};

const ticketsWord = (n: number) => `${String(n)} ${n === 1 ? 'ticket' : 'tickets'}`;

/** Title, dates or event time, and room/guests or tickets: the row first, else the entry. */
export function reviewSummary(
  kind: ReviewKind,
  entry: SummaryEntry | null,
  row: BookingRow | null | undefined,
  today: IsoDate,
): ReviewSummary {
  const s = entry?.summary ?? {};
  const fallbackTitle = entry?.title ?? '';
  if (kind === 'event') {
    if (row != null && 'listing' in row) {
      const b = fromEvent(row, today);
      return {
        title: b.title ?? fallbackTitle,
        when: eventWhen(b.start, b.end, b.time),
        extra:
          packagesLine(row.ticket_details) ??
          (s.tickets !== undefined ? ticketsWord(s.tickets) : null),
      };
    }
    const day = s.eventDate?.slice(0, 10);
    return {
      title: fallbackTitle,
      when: day !== undefined && isIsoDate(day) ? shortDate(day) : '',
      extra: s.tickets !== undefined && s.tickets > 0 ? ticketsWord(s.tickets) : null,
    };
  }
  const guests = s.guests !== undefined ? guestsCount(s.guests) : null;
  if (row != null && 'hotel' in row) {
    return {
      title: row.hotel?.name ?? fallbackTitle,
      when: stayWhen(row.check_in_date, row.check_out_date),
      extra: join([row.room_type?.name ?? s.roomName, guestsLine(row.adults, row.children)]),
    };
  }
  if (row != null && 'apartment' in row) {
    return {
      title: row.apartment?.name ?? fallbackTitle,
      when: stayWhen(row.check_in_date, row.check_out_date),
      extra: guestsCount(row.number_of_guests),
    };
  }
  return {
    title: fallbackTitle,
    when: stayWhen(s.checkIn, s.checkOut),
    extra: join([kind === 'hotel' ? s.roomName : null, guests]),
  };
}

export type StartAgain = { kind: ReviewKind; listingId: string; roomTypeId: string | null };

/** Where Start again goes: Select for the same listing (and room type), or null if unknown. */
export function startAgainTarget(
  kind: ReviewKind,
  entry: { listingId: string } | null,
  row: BookingRow | null | undefined,
): StartAgain | null {
  if (row != null) {
    if ('listing' in row && row.listing !== null)
      return { kind, listingId: row.listing.id, roomTypeId: null };
    if ('hotel' in row && row.hotel !== null)
      return { kind, listingId: row.hotel.id, roomTypeId: row.room_type?.id ?? null };
    if ('apartment' in row && row.apartment !== null)
      return { kind, listingId: row.apartment.id, roomTypeId: null };
  }
  if (entry !== null && entry.listingId !== '') {
    return { kind, listingId: entry.listingId, roomTypeId: null };
  }
  return null;
}

/** What Pay shows: the server total plus the charge estimate, to 2 dp. */
export function payableTotal(total: number, charge: { amount: number } | null): number {
  return round2(total + (charge?.amount ?? 0));
}
