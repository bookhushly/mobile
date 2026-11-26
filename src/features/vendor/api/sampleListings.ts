import {
  apartmentMoves,
  type ListingBooking,
  type StayStatus,
  type VendorEvent,
} from '@/features/vendor/domain/listings';
import type { ServedKind } from '@/features/vendor/domain/vendorProfile';
import type { ApiError } from '@/shared/lib/errors';
import { lagosToday, type IsoDate } from '@/shared/lib/lagosDay';
import { err, ok, type Result } from '@/shared/lib/result';

// SAMPLE DATA for hotels, apartments and events (vendor mode is dev-only until the web routes are
// wired; `/api/vendor/bookings` and the apartment status route already exist and come first).
// Changes made in this session are kept in memory.

const DAY = 86_400_000;
const day = (nowMs: number, n: number): IsoDate => lagosToday(nowMs + n * DAY);
const iso = (ms: number) => new Date(ms).toISOString();

function hotel(nowMs: number): ListingBooking[] {
  const b = (id: string, over: Partial<ListingBooking>): ListingBooking => ({
    id,
    kind: 'hotel',
    guest: '',
    unit: 'Deluxe King',
    checkIn: day(nowMs, 0),
    checkOut: day(nowMs, 3),
    guests: 2,
    total: 186_000,
    status: 'confirmed',
    payment: 'paid',
    ...over,
  });
  return [
    b('h1', { guest: 'Chidi Okeke' }),
    b('h2', {
      guest: 'Funmi Bello',
      unit: 'Standard Twin',
      checkOut: day(nowMs, 1),
      total: 48_000,
      payment: 'payAtHotel',
    }),
    b('h3', {
      guest: 'Emeka Nwosu',
      status: 'checked_in',
      unit: 'Executive Suite',
      total: 270_000,
    }),
    b('h4', {
      guest: 'Amina Yusuf',
      unit: 'Standard Twin',
      checkOut: day(nowMs, 2),
      total: 96_000,
    }),
    b('h5', {
      guest: 'David Ojo',
      status: 'checked_in',
      checkIn: day(nowMs, -2),
      checkOut: day(nowMs, 0),
      total: 124_000,
    }),
    b('h6', {
      guest: 'Ngozi Obi',
      status: 'checked_in',
      checkIn: day(nowMs, -1),
      checkOut: day(nowMs, 0),
      unit: 'Standard Twin',
      total: 48_000,
    }),
    b('h7', {
      guest: 'Seun Lawal',
      checkIn: day(nowMs, 2),
      checkOut: day(nowMs, 4),
      total: 124_000,
    }),
  ];
}

function apartment(nowMs: number): ListingBooking[] {
  const b = (id: string, over: Partial<ListingBooking>): ListingBooking => ({
    id,
    kind: 'apartment',
    guest: '',
    unit: '2-bed suite, Block C',
    checkIn: day(nowMs, 6),
    checkOut: day(nowMs, 9),
    guests: 4,
    total: 240_000,
    status: 'pending',
    payment: 'paid',
    ...over,
  });
  return [
    b('a1', { guest: 'Tolu Adeyemi' }),
    b('a2', {
      guest: 'Kemi Daniels',
      unit: 'Studio, Block B',
      checkIn: day(nowMs, 12),
      checkOut: day(nowMs, 14),
      guests: 2,
      total: 90_000,
    }),
    b('a3', {
      guest: 'Ibrahim Musa',
      status: 'confirmed',
      unit: '2-bed suite, Block A',
      checkIn: day(nowMs, 0),
      checkOut: day(nowMs, 4),
    }),
    b('a4', {
      guest: 'Grace Eze',
      status: 'checked_in',
      unit: 'Studio, Block B',
      checkIn: day(nowMs, -3),
      checkOut: day(nowMs, 0),
      guests: 1,
      total: 135_000,
    }),
  ];
}

const changed = new Map<string, StayStatus>();

export function sampleBookings(kind: ServedKind, nowMs: number): ListingBooking[] {
  const base = kind === 'hotel' ? hotel(nowMs) : kind === 'apartment' ? apartment(nowMs) : [];
  return base.map((x) => ({ ...x, status: changed.get(x.id) ?? x.status }));
}

export function sampleBooking(
  kind: ServedKind,
  id: string,
  nowMs: number,
): Result<ListingBooking, ApiError> {
  const x = sampleBookings(kind, nowMs).find((y) => y.id === id);
  return x === undefined ? err({ kind: 'notFound' }) : ok(x);
}

/** As the web route: the move must be allowed from the status the vendor saw (409 otherwise). */
export function sampleMoveBooking(
  kind: ServedKind,
  id: string,
  from: StayStatus,
  to: StayStatus,
  nowMs: number,
): Result<ListingBooking, ApiError> {
  const r = sampleBooking(kind, id, nowMs);
  if (!r.ok) return r;
  if (r.value.status !== from || !apartmentMoves(r.value).includes(to))
    return err({ kind: 'conflict', code: 'stale_status' });
  changed.set(id, to);
  const refund =
    to === 'cancelled' && r.value.payment === 'paid' ? ('onItsWay' as const) : undefined;
  return ok({ ...r.value, status: to, ...(refund === undefined ? {} : { refund }) });
}

const blocked = new Set<IsoDate>();

/** Apartment calendar: dates booked by guests, and dates the vendor blocked. */
export function sampleCalendar(nowMs: number): { booked: IsoDate[]; blocked: IsoDate[] } {
  const booked: IsoDate[] = [];
  for (const x of apartment(nowMs)) {
    if (x.status === 'cancelled') continue;
    for (
      let d = Date.parse(`${x.checkIn}T12:00:00Z`);
      d < Date.parse(`${x.checkOut}T12:00:00Z`);
      d += DAY
    )
      booked.push(lagosToday(d));
  }
  return { booked, blocked: [...blocked].sort() };
}

export function sampleToggleBlocked(date: IsoDate, nowMs: number): Result<boolean, ApiError> {
  if (sampleCalendar(nowMs).booked.includes(date))
    return err({ kind: 'conflict', code: 'date_booked' });
  if (blocked.has(date)) blocked.delete(date);
  else blocked.add(date);
  return ok(blocked.has(date));
}

export function sampleEvents(nowMs: number): VendorEvent[] {
  return [
    {
      id: 'e1',
      title: 'Lagos Jazz Night',
      startsAt: iso(nowMs + 2 * DAY + 11 * 3_600_000),
      venue: 'Muri Okunola Park, Victoria Island',
      capacity: 400,
      sold: 312,
      tickets: [
        { name: 'Regular', sold: 240, capacity: 300 },
        { name: 'VIP', sold: 72, capacity: 100 },
      ],
      soldThisWeek: 46,
      salesThisWeek: 1_380_000,
    },
    {
      id: 'e2',
      title: 'Afrobeats Brunch',
      startsAt: iso(nowMs + 14 * DAY),
      venue: 'The Wheatbaker, Ikoyi',
      capacity: 150,
      sold: 150,
      tickets: [{ name: 'Brunch pass', sold: 150, capacity: 150 }],
      soldThisWeek: 22,
      salesThisWeek: 550_000,
    },
    {
      id: 'e3',
      title: 'Comedy Thursdays',
      startsAt: iso(nowMs - 6 * DAY),
      venue: 'Terra Kulture, V.I.',
      capacity: null,
      sold: 188,
      tickets: [{ name: 'Standard', sold: 188, capacity: null }],
      soldThisWeek: 0,
      salesThisWeek: 0,
    },
  ];
}
