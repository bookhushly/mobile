import { bookingActions, cancelMoneyLine } from '@/features/customer/domain/bookingActions';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import { lagosToday } from '@/shared/lib/lagosDay';

// Noon in Lagos on 19 Oct 2026.
const NOW = Date.parse('2026-10-19T11:00:00Z');
const TODAY = lagosToday(NOW);
// The last second of 19 Oct in Lagos, and the first of 20 Oct (UTC+1).
const LAST_SECOND = Date.parse('2026-10-19T22:59:59Z');
const MIDNIGHT = Date.parse('2026-10-19T23:00:00Z');

type Listing = NonNullable<EventBookingRow['listing']>;
function listing(p: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    title: 'Afrobeats night',
    location: 'Eko Hotel, Lagos',
    media_urls: null,
    event_date: '2026-10-25T00:00:00',
    event_time: '2026-10-25T18:00:00+00:00',
    event_end_date: null,
    require_dynamic_ticket: false,
    ...p,
  };
}
function ev(p: Partial<EventBookingRow> = {}): EventBookingRow {
  return {
    id: 'e1',
    status: 'confirmed',
    payment_status: 'completed',
    total_amount: 45000,
    booking_date: '2026-10-01',
    booking_time: null,
    guests: 1,
    ticket_details: null,
    seat_assignments: null,
    created_at: null,
    listing: listing(),
    tickets: [],
    ...p,
  };
}
function ho(p: Partial<HotelBookingRow> = {}): HotelBookingRow {
  return {
    id: 'h1',
    check_in_date: '2026-10-25',
    check_out_date: '2026-10-27',
    adults: 2,
    children: 0,
    payment_status: 'completed',
    total_amount: 45000,
    booking_status: 'confirmed',
    checked_in: false,
    checked_in_at: null,
    checked_out_at: null,
    check_in_code: null,
    created_at: null,
    hotel: {
      id: 'ho1',
      name: 'Harbour Suites',
      city: null,
      state: null,
      address: null,
      image_urls: null,
      check_in_time: null,
      check_out_time: null,
    },
    room_type: null,
    ...p,
  };
}
function ap(p: Partial<ApartmentBookingRow> = {}): ApartmentBookingRow {
  return {
    id: 'a1',
    check_in_date: '2026-10-25',
    check_out_date: '2026-10-27',
    number_of_nights: 2,
    number_of_guests: 2,
    payment_status: 'paid',
    total_amount: 45000,
    booking_status: 'confirmed',
    checked_in_at: null,
    checked_out_at: null,
    created_at: null,
    apartment: {
      id: 'ap1',
      name: 'Lekki Loft',
      city: null,
      state: null,
      area: null,
      address: null,
      image_urls: null,
      check_in_time: null,
      check_out_time: null,
    },
    ...p,
  };
}

const at = (ms: number) => [lagosToday(ms), ms] as const;

describe('bookingActions: events', () => {
  it('a paid, confirmed, future event offers transfer, refund and cancel, in that order', () => {
    expect(bookingActions(ev(), 'event', TODAY, NOW)).toEqual(['transfer', 'refund', 'cancel']);
  });

  it('an unpaid pending event can only be cancelled', () => {
    const row = ev({ status: 'pending', payment_status: 'pending' });
    expect(bookingActions(row, 'event', TODAY, NOW)).toEqual(['cancel']);
  });

  it('a paid event still waiting for confirmation can be cancelled, not refunded or moved', () => {
    const row = ev({ status: 'pending' });
    expect(bookingActions(row, 'event', TODAY, NOW)).toEqual(['cancel']);
  });

  it.each(['cancelled', 'completed', null] as const)('status %p offers no cancel', (status) => {
    expect(bookingActions(ev({ status }), 'event', TODAY, NOW)).not.toContain('cancel');
  });

  it('a confirmed event with a refunded payment offers no refund or transfer', () => {
    const row = ev({ payment_status: 'refunded' });
    expect(bookingActions(row, 'event', TODAY, NOW)).toEqual(['cancel']);
  });

  it('the event day itself offers no cancel, refund or transfer (refused from its midnight)', () => {
    const row = ev({
      listing: listing({
        event_date: '2026-10-19T00:00:00',
        event_time: '2026-10-19T18:00:00+00:00',
      }),
    });
    expect(bookingActions(row, 'event', TODAY, NOW)).toEqual(['review']);
  });

  it('Lagos midnight: the day before the event offers actions until 23:59:59 Lagos', () => {
    const row = ev({
      listing: listing({ event_date: '2026-10-20T00:00:00', event_time: null }),
    });
    expect(bookingActions(row, 'event', ...at(LAST_SECOND))).toEqual([
      'transfer',
      'refund',
      'cancel',
    ]);
    expect(bookingActions(row, 'event', ...at(MIDNIGHT))).toEqual(['review']);
  });

  it('a start instant that has passed counts as passed', () => {
    const row = ev({
      listing: listing({ event_time: '2026-10-19T10:00:00+00:00' }),
    });
    expect(bookingActions(row, 'event', TODAY, NOW)).toEqual([]);
  });

  it('a hidden listing falls back to the booking date', () => {
    expect(bookingActions(ev({ listing: null }), 'event', TODAY, NOW)).toEqual([]);
    const future = ev({ listing: null, booking_date: '2026-10-25' });
    expect(bookingActions(future, 'event', TODAY, NOW)).toEqual(['transfer', 'refund', 'cancel']);
  });

  describe('review', () => {
    const past = (p: Partial<EventBookingRow> = {}) =>
      ev({ listing: listing({ event_date: '2026-10-18T00:00:00' }), ...p });

    it('a paid, confirmed or completed past event offers a review only', () => {
      expect(bookingActions(past(), 'event', TODAY, NOW)).toEqual(['review']);
      expect(bookingActions(past({ status: 'completed' }), 'event', TODAY, NOW)).toEqual([
        'review',
      ]);
    });

    it('the event day itself is reviewable (date ≤ today)', () => {
      const row = ev({
        listing: listing({ event_date: '2026-10-19T00:00:00', event_time: null }),
      });
      expect(bookingActions(row, 'event', TODAY, NOW)).toEqual(['review']);
    });

    it.each([
      ['unpaid', { payment_status: 'pending' }],
      ['refunded', { payment_status: 'refunded' }],
      ['cancelled', { status: 'cancelled' }],
      ['pending', { status: 'pending' }],
    ] as const)('%s offers no review', (_, p) => {
      expect(bookingActions(past(p), 'event', TODAY, NOW)).toEqual([]);
    });

    it('no listing id or no event date: no review', () => {
      expect(
        bookingActions(ev({ listing: null, booking_date: '2026-10-01' }), 'event', TODAY, NOW),
      ).toEqual([]);
      expect(
        bookingActions(
          ev({
            listing: listing({ event_date: null, event_time: null }),
            booking_date: '2026-10-01',
          }),
          'event',
          TODAY,
          NOW,
        ),
      ).toEqual([]);
    });

    it('Lagos midnight: the review appears from 00:00 Lagos on the event date', () => {
      const row = ev({
        listing: listing({ event_date: '2026-10-20T00:00:00', event_time: null }),
      });
      expect(bookingActions(row, 'event', ...at(LAST_SECOND))).not.toContain('review');
      expect(bookingActions(row, 'event', ...at(MIDNIGHT))).toEqual(['review']);
    });
  });
});

describe('bookingActions: hotels', () => {
  it('a future confirmed stay can be cancelled', () => {
    expect(bookingActions(ho(), 'hotel', TODAY, NOW)).toEqual(['cancel']);
  });

  it('an unpaid hold can be cancelled', () => {
    expect(bookingActions(ho({ payment_status: 'pending' }), 'hotel', TODAY, NOW)).toEqual([
      'cancel',
    ]);
  });

  it.each(['cancelled', 'checked_in', 'checked_out'] as const)('%s offers no cancel', (s) => {
    expect(bookingActions(ho({ booking_status: s }), 'hotel', TODAY, NOW)).not.toContain('cancel');
  });

  it('a checked-in flag or time also blocks cancel', () => {
    expect(bookingActions(ho({ checked_in: true }), 'hotel', TODAY, NOW)).toEqual([]);
    expect(
      bookingActions(ho({ checked_in_at: '2026-10-18T10:00:00Z' }), 'hotel', TODAY, NOW),
    ).toEqual([]);
  });

  it('check-in today or earlier offers no cancel', () => {
    const row = ho({ check_in_date: '2026-10-19', check_out_date: '2026-10-21' });
    expect(bookingActions(row, 'hotel', TODAY, NOW)).toEqual([]);
  });

  it('Lagos midnight: cancel is offered until 23:59:59 Lagos the day before check-in', () => {
    const row = ho({ check_in_date: '2026-10-20', check_out_date: '2026-10-22' });
    expect(bookingActions(row, 'hotel', ...at(LAST_SECOND))).toEqual(['cancel']);
    expect(bookingActions(row, 'hotel', ...at(MIDNIGHT))).toEqual([]);
  });

  it('hotels never offer refund or transfer', () => {
    const all = bookingActions(ho(), 'hotel', TODAY, NOW);
    expect(all).not.toContain('refund');
    expect(all).not.toContain('transfer');
  });

  describe('review', () => {
    const stayed = (p: Partial<HotelBookingRow> = {}) =>
      ho({ check_in_date: '2026-10-15', check_out_date: '2026-10-17', ...p });

    it('paid and checked out (or past check-out while confirmed or checked in)', () => {
      expect(
        bookingActions(stayed({ booking_status: 'checked_out' }), 'hotel', TODAY, NOW),
      ).toEqual(['review']);
      expect(bookingActions(stayed(), 'hotel', TODAY, NOW)).toEqual(['review']);
      expect(bookingActions(stayed({ booking_status: 'checked_in' }), 'hotel', TODAY, NOW)).toEqual(
        ['review'],
      );
    });

    it('checked out early, before the check-out date, is reviewable', () => {
      const row = ho({
        check_in_date: '2026-10-17',
        check_out_date: '2026-10-22',
        booking_status: 'checked_out',
      });
      expect(bookingActions(row, 'hotel', TODAY, NOW)).toEqual(['review']);
    });

    it('check-out today is reviewable', () => {
      const row = ho({ check_in_date: '2026-10-17', check_out_date: '2026-10-19' });
      expect(bookingActions(row, 'hotel', TODAY, NOW)).toEqual(['review']);
    });

    it.each([
      ['unpaid', { payment_status: 'pending' }],
      ['refunded', { payment_status: 'refunded' }],
      ['cancelled', { booking_status: 'cancelled' }],
      ['no status', { booking_status: null }],
      ['hidden hotel', { hotel: null }],
    ] as const)('%s offers no review', (_, p) => {
      expect(bookingActions(stayed(p), 'hotel', TODAY, NOW)).toEqual([]);
    });

    it('Lagos midnight: the review appears from 00:00 Lagos on the check-out date', () => {
      const row = ho({ check_in_date: '2026-10-18', check_out_date: '2026-10-20' });
      expect(bookingActions(row, 'hotel', ...at(LAST_SECOND))).toEqual([]);
      expect(bookingActions(row, 'hotel', ...at(MIDNIGHT))).toEqual(['review']);
    });
  });
});

describe('bookingActions: apartments', () => {
  it('a confirmed or pending future stay can be cancelled', () => {
    expect(bookingActions(ap(), 'apartment', TODAY, NOW)).toEqual(['cancel']);
    expect(
      bookingActions(
        ap({ booking_status: 'pending', payment_status: 'pending' }),
        'apartment',
        TODAY,
        NOW,
      ),
    ).toEqual(['cancel']);
  });

  it.each(['cancelled', 'checked_in', 'checked_out', 'no_show'] as const)(
    '%s offers no cancel',
    (s) => {
      expect(bookingActions(ap({ booking_status: s }), 'apartment', TODAY, NOW)).not.toContain(
        'cancel',
      );
    },
  );

  it('a stay that has already started offers no cancel (the server has no date check)', () => {
    const row = ap({ check_in_date: '2026-10-19', check_out_date: '2026-10-21' });
    expect(bookingActions(row, 'apartment', TODAY, NOW)).toEqual([]);
  });

  describe('review', () => {
    it('paid (`paid`), checked out or past check-out', () => {
      const past = ap({ check_in_date: '2026-10-15', check_out_date: '2026-10-17' });
      expect(bookingActions(past, 'apartment', TODAY, NOW)).toEqual(['review']);
      expect(
        bookingActions({ ...past, booking_status: 'checked_out' }, 'apartment', TODAY, NOW),
      ).toEqual(['review']);
    });

    it.each([
      ['partially refunded', { payment_status: 'partially_refunded' }],
      ['unpaid', { payment_status: 'pending' }],
      ['no-show', { booking_status: 'no_show' }],
      ['pending', { booking_status: 'pending' }],
      ['hidden apartment', { apartment: null }],
    ] as const)('%s offers no review', (_, p) => {
      const row = ap({ check_in_date: '2026-10-15', check_out_date: '2026-10-17', ...p });
      expect(bookingActions(row, 'apartment', TODAY, NOW)).toEqual([]);
    });
  });
});

it('a row that does not match its kind offers nothing', () => {
  expect(bookingActions(ho(), 'event', TODAY, NOW)).toEqual([]);
  expect(bookingActions(ev(), 'apartment', TODAY, NOW)).toEqual([]);
  expect(bookingActions(ap(), 'hotel', TODAY, NOW)).toEqual([]);
});

describe('cancelMoneyLine', () => {
  it('unpaid bookings are not charged', () => {
    expect(cancelMoneyLine(ev({ payment_status: 'pending' }), 'event')).toBe('nothingCharged');
    expect(cancelMoneyLine(ho({ payment_status: null }), 'hotel')).toBe('nothingCharged');
    expect(cancelMoneyLine(ap({ payment_status: 'failed' }), 'apartment')).toBe('nothingCharged');
  });

  it('a paid hotel stay is refunded in full', () => {
    expect(cancelMoneyLine(ho(), 'hotel')).toBe('hotelFullRefund');
  });

  it('a paid event or apartment is refunded if the payment can be reversed', () => {
    expect(cancelMoneyLine(ev(), 'event')).toBe('refundIfReversible');
    expect(cancelMoneyLine(ap(), 'apartment')).toBe('refundIfReversible');
  });

  it('an already refunded payment moves no money', () => {
    expect(cancelMoneyLine(ev({ payment_status: 'refunded' }), 'event')).toBe('nothingCharged');
    expect(cancelMoneyLine(ap({ payment_status: 'partially_refunded' }), 'apartment')).toBe(
      'nothingCharged',
    );
  });
});
