import { dayParts, daysBetween, type IsoDate } from '@/shared/lib/lagosDay';

// Hotels, apartments and events (plan slice 7). Statuses are the web's own; the apartment moves
// are the web route's (`lib/vendor/apartment-booking-status.js`).

export type StayStatus = 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';

export type ListingBooking = {
  id: string;
  kind: 'hotel' | 'apartment';
  guest: string;
  /** The room type or apartment booked. */
  unit: string;
  checkIn: IsoDate;
  checkOut: IsoDate;
  guests: number;
  total: number;
  status: StayStatus;
  /** Hotels may take payment at the desk; that decides check-in. */
  payment: 'paid' | 'payAtHotel' | 'unpaid';
};

export function staySummary(
  list: readonly ListingBooking[],
  today: IsoDate,
): { arriving: number; arrived: number; leaving: number; toConfirm: number } {
  let arriving = 0;
  let arrived = 0;
  let leaving = 0;
  let toConfirm = 0;
  for (const x of list) {
    if (x.status === 'pending') toConfirm++;
    if (x.status === 'cancelled') continue;
    if (x.checkIn === today && (x.status === 'confirmed' || x.status === 'checked_in')) {
      arriving++;
      if (x.status === 'checked_in') arrived++;
    }
    if (x.checkOut === today && x.status === 'checked_in') leaving++;
  }
  return { arriving, arrived, leaving, toConfirm };
}

export type BookingTab = 'toConfirm' | 'upcoming' | 'staying' | 'past';

export function splitBookings(
  list: readonly ListingBooking[],
  today: IsoDate,
): Record<BookingTab, ListingBooking[]> {
  const out: Record<BookingTab, ListingBooking[]> = {
    toConfirm: [],
    upcoming: [],
    staying: [],
    past: [],
  };
  for (const x of list) {
    if (x.status === 'pending') out.toConfirm.push(x);
    else if (x.status === 'confirmed' && x.checkOut >= today) out.upcoming.push(x);
    else if (x.status === 'checked_in') out.staying.push(x);
    else out.past.push(x);
  }
  const byIn = (a: ListingBooking, c: ListingBooking) => a.checkIn.localeCompare(c.checkIn);
  out.toConfirm.sort(byIn);
  out.upcoming.sort(byIn);
  out.staying.sort(byIn);
  return out;
}

/** What a vendor may do to an apartment booking next. Hotel stays move at the front desk. */
export function apartmentMoves(x: ListingBooking): StayStatus[] {
  if (x.kind !== 'apartment') return [];
  switch (x.status) {
    case 'pending':
      return ['confirmed', 'cancelled'];
    case 'confirmed':
      return ['checked_in', 'cancelled'];
    case 'checked_in':
      return ['checked_out'];
    case 'checked_out':
    case 'cancelled':
      return [];
  }
}

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** The pieces of a stay, for screens that show only some of them. */
export function stayParts(x: ListingBooking): { dates: string; nights: string; guests: string } {
  const a = dayParts(x.checkIn);
  const z = dayParts(x.checkOut);
  return {
    dates:
      a.month === z.month
        ? `${a.weekday} ${a.day} – ${z.weekday} ${z.day} ${z.month}`
        : `${a.weekday} ${a.day} ${a.month} – ${z.weekday} ${z.day} ${z.month}`,
    nights: plural(daysBetween(x.checkIn, x.checkOut), 'night', 'nights'),
    guests: plural(x.guests, 'guest', 'guests'),
  };
}

/** "Sat 5 – Tue 8 Dec · 3 nights · 4 guests". */
export function bookingLine(x: ListingBooking): string {
  const p = stayParts(x);
  return `${p.dates} · ${p.nights} · ${p.guests}`;
}

export type VendorEvent = {
  id: string;
  title: string;
  startsAt: string;
  venue: string;
  /** Null when the event has no ticket limit. */
  capacity: number | null;
  sold: number;
  tickets: { name: string; sold: number; capacity: number | null }[];
  soldThisWeek: number;
  salesThisWeek: number;
};

/** The soonest event still to start. */
export function nextEvent(events: readonly VendorEvent[], nowMs: number): VendorEvent | null {
  let best: VendorEvent | null = null;
  for (const e of events) {
    const t = Date.parse(e.startsAt);
    if (t > nowMs && (best === null || t < Date.parse(best.startsAt))) best = e;
  }
  return best;
}

export function ticketsLine(e: VendorEvent): string {
  if (e.capacity === null) return `${String(e.sold)} sold`;
  if (e.sold >= e.capacity) return `Sold out · ${String(e.capacity)} tickets`;
  return `${String(e.sold)} of ${String(e.capacity)} sold`;
}
