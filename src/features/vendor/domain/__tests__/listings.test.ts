import {
  apartmentMoves,
  bookingLine,
  nextEvent,
  splitBookings,
  staySummary,
  ticketsLine,
  type ListingBooking,
  type VendorEvent,
} from '@/features/vendor/domain/listings';

const TODAY = '2026-11-29';
const NOW = Date.parse('2026-11-29T07:20:00Z');

const b = (over: Partial<ListingBooking> = {}): ListingBooking => ({
  id: 'b1',
  kind: 'apartment',
  guest: 'Tolu Adeyemi',
  unit: '2-bed suite, Block C',
  checkIn: '2026-12-05',
  checkOut: '2026-12-08',
  guests: 4,
  total: 240_000,
  status: 'pending',
  payment: 'paid',
  ...over,
});

describe('staySummary', () => {
  it('counts what happens today, and what waits for an answer', () => {
    const s = staySummary(
      [
        b({ id: 'a', status: 'confirmed', checkIn: TODAY }),
        b({ id: 'b', status: 'checked_in', checkIn: TODAY }),
        b({ id: 'c', status: 'checked_in', checkIn: '2026-11-27', checkOut: TODAY }),
        b({ id: 'd', status: 'pending' }),
        b({ id: 'e', status: 'cancelled', checkIn: TODAY }),
      ],
      TODAY,
    );
    expect(s).toEqual({ arriving: 2, arrived: 1, leaving: 1, toConfirm: 1 });
  });
});

describe('splitBookings', () => {
  it('to confirm, coming up, staying now, past (cancelled are past)', () => {
    const r = splitBookings(
      [
        b({ id: 'p' }),
        b({ id: 'u', status: 'confirmed' }),
        b({ id: 's', status: 'checked_in', checkIn: '2026-11-27' }),
        b({ id: 'o', status: 'checked_out', checkIn: '2026-11-20', checkOut: '2026-11-22' }),
        b({ id: 'x', status: 'cancelled' }),
      ],
      TODAY,
    );
    expect(r.toConfirm.map((x) => x.id)).toEqual(['p']);
    expect(r.upcoming.map((x) => x.id)).toEqual(['u']);
    expect(r.staying.map((x) => x.id)).toEqual(['s']);
    expect(r.past.map((x) => x.id)).toEqual(['o', 'x']);
  });
});

describe('apartmentMoves (the web route’s transitions)', () => {
  it.each([
    ['pending', ['confirmed', 'cancelled']],
    ['confirmed', ['checked_in', 'cancelled']],
    ['checked_in', ['checked_out']],
    ['checked_out', []],
    ['cancelled', []],
  ] as const)('%s -> %o', (status, moves) => {
    expect(apartmentMoves(b({ status }))).toEqual(moves);
  });
  it('hotel bookings move at the front desk, not here', () => {
    expect(apartmentMoves(b({ kind: 'hotel', status: 'confirmed' }))).toEqual([]);
  });
});

describe('bookingLine', () => {
  it('dates, nights and how it is paid', () => {
    expect(bookingLine(b())).toBe('Sat 5 – Tue 8 Dec · 3 nights · 4 guests');
    expect(bookingLine(b({ checkOut: '2026-12-06', guests: 1 }))).toBe(
      'Sat 5 – Sun 6 Dec · 1 night · 1 guest',
    );
  });
});

describe('events', () => {
  const ev = (over: Partial<VendorEvent> = {}): VendorEvent => ({
    id: 'e1',
    title: 'Lagos Jazz Night',
    startsAt: '2026-12-06T18:00:00Z',
    venue: 'Muri Okunola Park',
    capacity: 400,
    sold: 312,
    tickets: [],
    soldThisWeek: 46,
    salesThisWeek: 1_380_000,
    ...over,
  });
  it('the next event still to happen', () => {
    expect(
      nextEvent(
        [
          ev({ id: 'past', startsAt: '2026-11-20T18:00:00Z' }),
          ev({ id: 'later', startsAt: '2026-12-20T18:00:00Z' }),
          ev(),
        ],
        NOW,
      )?.id,
    ).toBe('e1');
    expect(nextEvent([ev({ startsAt: '2026-11-20T18:00:00Z' })], NOW)).toBeNull();
  });
  it('sold against capacity, and a sold-out event says so', () => {
    expect(ticketsLine(ev())).toBe('312 of 400 sold');
    expect(ticketsLine(ev({ sold: 400 }))).toBe('Sold out · 400 tickets');
    expect(ticketsLine(ev({ capacity: null }))).toBe('312 sold');
  });
});
