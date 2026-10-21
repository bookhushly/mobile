import {
  clockLabel,
  fromApartment,
  fromEvent,
  fromHotel,
  kindWord,
  splitBookings,
  type MyBooking,
} from '@/features/customer/domain/myBookings';
import type {
  ApartmentBookingRow,
  EventBookingRow,
  HotelBookingRow,
} from '@/features/customer/schemas/bookings';
import { lagosToday } from '@/shared/lib/lagosDay';

// Payments off unless a test turns them on: the 4a copy points to the website.
const mockSwitches = { payments: false };
jest.mock('@/shared/config/features', () => ({
  get CHECKOUT_PAYMENTS_ENABLED() {
    return mockSwitches.payments;
  },
}));
beforeEach(() => {
  mockSwitches.payments = false;
});

const TODAY = '2026-10-13';
type Listing = NonNullable<EventBookingRow['listing']>;

// 18:00Z = 19:00 Lagos.
function listing(p: Partial<Listing> = {}): Listing {
  return {
    id: 'l1',
    title: 'Afrobeats night',
    location: 'Eko Hotel, Lagos',
    media_urls: ['https://cdn.example/a.jpg'],
    event_date: `${TODAY}T00:00:00`,
    event_time: `${TODAY}T18:00:00+00:00`,
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
    booking_time: '10:00:00',
    guests: 1,
    ticket_details: null,
    seat_assignments: null,
    created_at: '2026-10-01T10:00:00+00:00',
    listing: listing(),
    tickets: [{ id: 't1', ticket_type: 'Regular', ticket_index: 1, checked_in_at: null }],
    ...p,
  };
}

type Hotel = NonNullable<HotelBookingRow['hotel']>;
function hotelEmbed(p: Partial<Hotel> = {}): Hotel {
  return {
    id: 'ho1',
    name: 'Harbour Suites',
    city: 'Ikeja',
    state: 'Lagos',
    address: null,
    image_urls: ['https://cdn.example/h.jpg'],
    check_in_time: '14:00:00',
    check_out_time: '12:00:00',
    ...p,
  };
}
function ho(p: Partial<HotelBookingRow> = {}): HotelBookingRow {
  return {
    id: 'h1',
    check_in_date: '2026-10-15',
    check_out_date: '2026-10-17',
    adults: 2,
    children: 0,
    payment_status: 'completed',
    total_amount: 45000,
    booking_status: 'confirmed',
    checked_in: false,
    checked_in_at: null,
    checked_out_at: null,
    check_in_code: 'AB12CD34',
    created_at: '2026-10-01T10:00:00+00:00',
    hotel: hotelEmbed(),
    room_type: { id: 'rt1', name: 'Deluxe' },
    ...p,
  };
}

type Apt = NonNullable<ApartmentBookingRow['apartment']>;
function aptEmbed(p: Partial<Apt> = {}): Apt {
  return {
    id: 'ap1',
    name: 'Lekki Loft',
    city: 'Lagos',
    state: 'Lagos',
    area: 'Lekki',
    address: null,
    image_urls: [],
    check_in_time: '15:00:00',
    check_out_time: '11:00:00',
    ...p,
  };
}
function ap(p: Partial<ApartmentBookingRow> = {}): ApartmentBookingRow {
  return {
    id: 'a1',
    check_in_date: '2026-10-15',
    check_out_date: '2026-10-17',
    number_of_nights: 2,
    number_of_guests: 2,
    payment_status: 'paid',
    total_amount: 45000,
    booking_status: 'confirmed',
    checked_in_at: null,
    checked_out_at: null,
    created_at: '2026-10-01T10:00:00+00:00',
    apartment: aptEmbed(),
    ...p,
  };
}

describe('clockLabel', () => {
  it.each([
    ['19:00', '7:00 pm'],
    ['09:30:00', '9:30 am'],
    ['12:00', '12:00 pm'],
    ['00:15', '12:15 am'],
  ])('%s → %s', (input, out) => {
    expect(clockLabel(input)).toBe(out);
  });

  it('returns null for null or unreadable input', () => {
    expect(clockLabel(null)).toBeNull();
    expect(clockLabel('7pm')).toBeNull();
    expect(clockLabel('25:00')).toBeNull();
  });
});

describe('kindWord', () => {
  it('names each kind', () => {
    expect(kindWord('event')).toBe('Event');
    expect(kindWord('hotel')).toBe('Hotel stay');
    expect(kindWord('apartment')).toBe('Apartment stay');
  });
});

describe('fromEvent', () => {
  it('takes dates from the listing, the time in Lagos', () => {
    const b = fromEvent(ev({ listing: listing({ event_date: '2026-10-18T00:00:00' }) }), TODAY);
    expect(b.kind).toBe('event');
    expect(b.start).toBe('2026-10-18');
    expect(b.end).toBe('2026-10-18');
    expect(b.time).toBe('19:00');
    expect(b.title).toBe('Afrobeats night');
    expect(b.place).toBe('Eko Hotel, Lagos');
    expect(b.imageUrl).toBe('https://cdn.example/a.jpg');
    expect(b.createdAt).toBe('2026-10-01T10:00:00+00:00');
  });

  it('paid and confirmed today → today, Confirmed, "Today · 7:00 pm"', () => {
    const b = fromEvent(ev(), TODAY);
    expect(b.when).toBe('today');
    expect(b.status).toBe('Confirmed');
    expect(b.tone).toBe('success');
    expect(b.paid).toBe(true);
    expect(b.pending).toBe(false);
    expect(b.next).toBe('Today · 7:00 pm');
  });

  it('today without a time says just "Today"', () => {
    const b = fromEvent(ev({ booking_time: null, listing: listing({ event_time: null }) }), TODAY);
    expect(b.time).toBeNull();
    expect(b.next).toBe('Today');
  });

  it('confirmed on 18 Oct → upcoming, "Sun 18 Oct · 7:00 pm"', () => {
    const b = fromEvent(
      ev({
        listing: listing({
          event_date: '2026-10-18T00:00:00',
          event_time: '2026-10-18T18:00:00+00:00',
        }),
      }),
      TODAY,
    );
    expect(b.when).toBe('upcoming');
    expect(b.next).toBe('Sun 18 Oct · 7:00 pm');
  });

  it('pending and unpaid → Pending payment, finish paying', () => {
    const b = fromEvent(ev({ status: 'pending', payment_status: 'pending' }), TODAY);
    expect(b.status).toBe('Pending payment');
    expect(b.tone).toBe('warning');
    expect(b.paid).toBe(false);
    expect(b.pending).toBe(true);
    expect(b.next).toBe('Finish paying on bookhushly.com');
  });

  it('with in-app payment on, pending reads finish paying to confirm (P21)', () => {
    mockSwitches.payments = true;
    expect(fromEvent(ev({ status: 'pending', payment_status: 'pending' }), TODAY).next).toBe(
      'Finish paying to confirm',
    );
    expect(fromHotel(ho({ payment_status: 'pending' }), TODAY).next).toBe(
      'Finish paying to confirm',
    );
  });

  it('cancelled on any date → past, Cancelled', () => {
    const b = fromEvent(
      ev({ status: 'cancelled', listing: listing({ event_date: '2026-12-01T00:00:00' }) }),
      TODAY,
    );
    expect(b.when).toBe('past');
    expect(b.status).toBe('Cancelled');
    expect(b.tone).toBe('neutral');
    expect(b.pending).toBe(false);
    expect(b.next).toBe('Cancelled');
  });

  it('completed → past, Completed, "Attended" when a ticket was admitted', () => {
    const b = fromEvent(
      ev({
        status: 'completed',
        tickets: [
          {
            id: 't1',
            ticket_type: 'Regular',
            ticket_index: 1,
            checked_in_at: '2026-10-13T18:40:00Z',
          },
        ],
      }),
      TODAY,
    );
    expect(b.when).toBe('past');
    expect(b.status).toBe('Completed');
    expect(b.tone).toBe('neutral');
    expect(b.next).toBe('Attended');
  });

  it('confirmed but dated before today → past, keeps the word, next is the date', () => {
    const b = fromEvent(ev({ listing: listing({ event_date: '2026-10-10T00:00:00' }) }), TODAY);
    expect(b.when).toBe('past');
    expect(b.status).toBe('Confirmed');
    expect(b.next).toBe('Sat 10 Oct');
  });

  it('images: only https urls are used, others are dropped', () => {
    const img = (media_urls: string[]) =>
      fromEvent(ev({ listing: listing({ media_urls }) }), TODAY).imageUrl;
    expect(img(['http://cdn.example/a.jpg'])).toBeNull();
    expect(img(['file:///etc/passwd'])).toBeNull();
    expect(img(['data:image/png;base64,AAAA'])).toBeNull();
    expect(img(['javascript:alert(1)'])).toBeNull();
    expect(img(['', 'http://x/a.jpg', 'https://cdn.example/b.jpg'])).toBe(
      'https://cdn.example/b.jpg',
    );
    expect(img(['HTTPS://cdn.example/c.jpg'])).toBe('HTTPS://cdn.example/c.jpg');
  });

  it('hidden listing → no title or place, dates from the booking', () => {
    const b = fromEvent(
      ev({ listing: null, booking_date: '2026-10-20', booking_time: '20:30:00' }),
      TODAY,
    );
    expect(b.title).toBeNull();
    expect(b.place).toBeNull();
    expect(b.imageUrl).toBeNull();
    expect(b.start).toBe('2026-10-20');
    expect(b.end).toBe('2026-10-20');
    expect(b.time).toBe('20:30');
    expect(b.when).toBe('upcoming');
  });

  it('refunded → Refunded, not a request to pay', () => {
    const b = fromEvent(ev({ payment_status: 'refunded' }), TODAY);
    expect(b.status).toBe('Refunded');
    expect(b.tone).toBe('neutral');
    expect(b.pending).toBe(false);
    expect(b.when).toBe('past');
  });

  it('is "today" by the Lagos day: 23:30 UTC on the 12th is already the 13th', () => {
    const today = lagosToday(Date.UTC(2026, 9, 12, 23, 30));
    expect(fromEvent(ev(), today).when).toBe('today');
    // …and an event at 23:30 Lagos on the 13th is still today at 22:59 UTC.
    const late = ev({ listing: listing({ event_time: `${TODAY}T22:30:00+00:00` }) });
    expect(fromEvent(late, lagosToday(Date.UTC(2026, 9, 13, 22, 59))).when).toBe('today');
    expect(fromEvent(late, lagosToday(Date.UTC(2026, 9, 13, 23, 0))).when).toBe('past');
  });

  it.each(['pending', null] as const)(
    'status %p with payment completed → Processing, tickets on the way',
    (status) => {
      const b = fromEvent(
        ev({ status, listing: listing({ event_date: '2026-10-18T00:00:00' }) }),
        TODAY,
      );
      expect(b.status).toBe('Processing');
      expect(b.tone).toBe('info');
      expect(b.paid).toBe(true);
      expect(b.pending).toBe(false);
      expect(b.when).toBe('upcoming');
      expect(b.next).toBe('Payment received — your tickets are on the way');
    },
  );

  it('a past event never paid → Not paid, neutral, no request to pay', () => {
    const b = fromEvent(
      ev({
        status: 'pending',
        payment_status: 'pending',
        listing: listing({ event_date: '2026-10-10T00:00:00' }),
      }),
      TODAY,
    );
    expect(b.when).toBe('past');
    expect(b.status).toBe('Not paid');
    expect(b.tone).toBe('neutral');
    expect(b.pending).toBe(false);
    expect(b.next).toBe('Sat 10 Oct');
  });

  describe('multi-day events', () => {
    const multi = (end: string | null) =>
      ev({
        listing: listing({ event_date: '2026-10-11T00:00:00', event_end_date: end }),
      });

    it('ends on event_end_date', () => {
      const b = fromEvent(multi('2026-10-14'), TODAY);
      expect(b.start).toBe('2026-10-11');
      expect(b.end).toBe('2026-10-14');
    });

    it('is today while running, past after the last day, upcoming before the first', () => {
      expect(fromEvent(multi('2026-10-14'), TODAY).when).toBe('today');
      expect(fromEvent(multi('2026-10-14'), TODAY).next).toBe('Today · 7:00 pm');
      expect(fromEvent(multi('2026-10-14'), '2026-10-15').when).toBe('past');
      expect(fromEvent(multi('2026-10-14'), '2026-10-10').when).toBe('upcoming');
    });

    it('accepts a timestamp-shaped end date', () => {
      expect(fromEvent(multi('2026-10-14T00:00:00'), TODAY).end).toBe('2026-10-14');
    });

    it('ends on the start day without an end date (or one before the start)', () => {
      expect(fromEvent(multi(null), TODAY).end).toBe('2026-10-11');
      expect(fromEvent(multi(null), TODAY).when).toBe('past');
      expect(fromEvent(multi('2026-10-09'), TODAY).end).toBe('2026-10-11');
    });

    it('a hidden listing has no end date: one day from the booking', () => {
      const b = fromEvent(ev({ listing: null, booking_date: TODAY }), TODAY);
      expect(b.end).toBe(TODAY);
    });
  });
});

describe('fromHotel', () => {
  it('counts completed as paid', () => {
    expect(fromHotel(ho(), TODAY).paid).toBe(true);
    expect(fromHotel(ho({ payment_status: 'pending' }), TODAY).paid).toBe(false);
  });

  it('unpaid and confirmed → Pending payment', () => {
    const b = fromHotel(ho({ payment_status: 'pending' }), TODAY);
    expect(b.status).toBe('Pending payment');
    expect(b.tone).toBe('warning');
    expect(b.pending).toBe(true);
    expect(b.next).toBe('Finish paying on bookhushly.com');
  });

  it('paid, 15–17 Oct → upcoming, Confirmed, "Check-in Thu 15 Oct from 2:00 pm"', () => {
    const b = fromHotel(ho(), TODAY);
    expect(b.when).toBe('upcoming');
    expect(b.status).toBe('Confirmed');
    expect(b.tone).toBe('success');
    expect(b.start).toBe('2026-10-15');
    expect(b.end).toBe('2026-10-17');
    expect(b.time).toBe('14:00');
    expect(b.next).toBe('Check-in Thu 15 Oct from 2:00 pm');
  });

  it('leaves the time off when the hotel has none', () => {
    const b = fromHotel(ho({ hotel: hotelEmbed({ check_in_time: null }) }), TODAY);
    expect(b.next).toBe('Check-in Thu 15 Oct');
  });

  it('paid, check-in today → today, "Check-in today from 2:00 pm"', () => {
    const b = fromHotel(ho({ check_in_date: TODAY }), TODAY);
    expect(b.when).toBe('today');
    expect(b.next).toBe('Check-in today from 2:00 pm');
  });

  it('checked in, out tomorrow → today, Checked in, "Check-out Wed 14 Oct"', () => {
    const b = fromHotel(
      ho({
        booking_status: 'checked_in',
        checked_in: true,
        check_in_date: '2026-10-11',
        check_out_date: '2026-10-14',
      }),
      TODAY,
    );
    expect(b.when).toBe('today');
    expect(b.status).toBe('Checked in');
    expect(b.tone).toBe('info');
    expect(b.next).toBe('Check-out Wed 14 Oct');
  });

  it('checked out → past, "Stayed 10–12 Oct"', () => {
    const b = fromHotel(
      ho({
        booking_status: 'checked_out',
        check_in_date: '2026-10-10',
        check_out_date: '2026-10-12',
      }),
      TODAY,
    );
    expect(b.when).toBe('past');
    expect(b.status).toBe('Checked out');
    expect(b.tone).toBe('neutral');
    expect(b.next).toBe('Stayed 10–12 Oct');
  });

  it('cancelled → past, Cancelled', () => {
    const b = fromHotel(ho({ booking_status: 'cancelled', payment_status: 'pending' }), TODAY);
    expect(b.when).toBe('past');
    expect(b.status).toBe('Cancelled');
    expect(b.tone).toBe('neutral');
    expect(b.pending).toBe(false);
  });

  it('paid, out before today, still confirmed (no-show) → past, Confirmed, stay range', () => {
    const b = fromHotel(ho({ check_in_date: '2026-10-08', check_out_date: '2026-10-10' }), TODAY);
    expect(b.when).toBe('past');
    expect(b.status).toBe('Confirmed');
    expect(b.next).toBe('8–10 Oct');
  });

  it('title is the hotel name; place is "City, State" without nulls', () => {
    const b = fromHotel(ho(), TODAY);
    expect(b.title).toBe('Harbour Suites');
    expect(b.place).toBe('Ikeja, Lagos');
    expect(b.imageUrl).toBe('https://cdn.example/h.jpg');
    expect(fromHotel(ho({ hotel: hotelEmbed({ city: null }) }), TODAY).place).toBe('Lagos');
  });

  it('hidden hotel → no title or place, dates and status still there', () => {
    const b = fromHotel(ho({ hotel: null }), TODAY);
    expect(b.title).toBeNull();
    expect(b.place).toBeNull();
    expect(b.time).toBeNull();
    expect(b.status).toBe('Confirmed');
    expect(b.next).toBe('Check-in Thu 15 Oct');
  });

  it('a legacy row with no status but checked_in true reads as Checked in', () => {
    const b = fromHotel(
      ho({ booking_status: null, checked_in: true, check_in_date: '2026-10-12' }),
      TODAY,
    );
    expect(b.status).toBe('Checked in');
  });

  it('still checked in after the check-out date → past, word unchanged', () => {
    const b = fromHotel(
      ho({
        booking_status: 'checked_in',
        checked_in: true,
        check_in_date: '2026-10-09',
        check_out_date: '2026-10-12',
      }),
      TODAY,
    );
    expect(b.when).toBe('past');
    expect(b.status).toBe('Checked in');
    expect(b.next).toBe('9–12 Oct');
  });

  it('an early arrival checked in before its check-in date is today', () => {
    const b = fromHotel(ho({ booking_status: 'checked_in', checked_in: true }), TODAY);
    expect(b.when).toBe('today');
    expect(b.next).toBe('Check-out Sat 17 Oct');
  });

  it('checked in with check-out today stays today', () => {
    const b = fromHotel(
      ho({ booking_status: 'checked_in', check_in_date: '2026-10-11', check_out_date: TODAY }),
      TODAY,
    );
    expect(b.when).toBe('today');
    expect(b.next).toBe('Check-out today');
  });

  it('a past stay never paid → Not paid, neutral, no request to pay', () => {
    const b = fromHotel(
      ho({ payment_status: 'pending', check_in_date: '2026-10-08', check_out_date: '2026-10-10' }),
      TODAY,
    );
    expect(b.when).toBe('past');
    expect(b.status).toBe('Not paid');
    expect(b.tone).toBe('neutral');
    expect(b.pending).toBe(false);
    expect(b.next).toBe('8–10 Oct');
  });
});

describe('fromApartment', () => {
  it('a past stay never paid → Not paid', () => {
    const b = fromApartment(
      ap({
        booking_status: 'pending',
        payment_status: 'pending',
        check_in_date: '2026-10-08',
        check_out_date: '2026-10-10',
      }),
      TODAY,
    );
    expect(b.when).toBe('past');
    expect(b.status).toBe('Not paid');
    expect(b.tone).toBe('neutral');
    expect(b.pending).toBe(false);
  });

  it('counts only paid as paid', () => {
    expect(fromApartment(ap(), TODAY).paid).toBe(true);
    expect(fromApartment(ap({ payment_status: 'pending' }), TODAY).paid).toBe(false);
  });

  it.each(['refunded', 'partially_refunded'] as const)('%s → Refunded', (s) => {
    const b = fromApartment(ap({ payment_status: s }), TODAY);
    expect(b.status).toBe('Refunded');
    expect(b.tone).toBe('neutral');
    expect(b.pending).toBe(false);
  });

  it('pending and unpaid → Pending payment; pending but paid → Confirmed', () => {
    const unpaid = fromApartment(
      ap({ booking_status: 'pending', payment_status: 'pending' }),
      TODAY,
    );
    expect(unpaid.status).toBe('Pending payment');
    expect(unpaid.pending).toBe(true);
    const paid = fromApartment(ap({ booking_status: 'pending' }), TODAY);
    expect(paid.status).toBe('Confirmed');
    expect(paid.tone).toBe('success');
  });

  it('no_show → past, No-show', () => {
    const b = fromApartment(ap({ booking_status: 'no_show' }), TODAY);
    expect(b.when).toBe('past');
    expect(b.status).toBe('No-show');
    expect(b.tone).toBe('neutral');
  });

  it('follows the hotel rules otherwise', () => {
    expect(fromApartment(ap(), TODAY).next).toBe('Check-in Thu 15 Oct from 3:00 pm');
    const inHouse = fromApartment(
      ap({ booking_status: 'checked_in', check_in_date: '2026-10-12', check_out_date: TODAY }),
      TODAY,
    );
    expect(inHouse.when).toBe('today');
    expect(inHouse.status).toBe('Checked in');
    expect(inHouse.next).toBe('Check-out today');
    expect(fromApartment(ap({ booking_status: 'cancelled' }), TODAY).status).toBe('Cancelled');
    expect(
      fromApartment(
        ap({
          booking_status: 'checked_out',
          check_in_date: '2026-10-10',
          check_out_date: '2026-10-12',
        }),
        TODAY,
      ).next,
    ).toBe('Stayed 10–12 Oct');
  });

  it('place is "area, city" without nulls; title is the name', () => {
    const b = fromApartment(ap(), TODAY);
    expect(b.title).toBe('Lekki Loft');
    expect(b.place).toBe('Lekki, Lagos');
    expect(b.imageUrl).toBeNull();
    expect(fromApartment(ap({ apartment: aptEmbed({ area: null }) }), TODAY).place).toBe('Lagos');
  });
});

describe('splitBookings', () => {
  function mk(id: string, when: MyBooking['when'], start: string, p: Partial<MyBooking> = {}) {
    return {
      ...fromEvent(ev({ id }), TODAY),
      id,
      when,
      start,
      end: start,
      time: null,
      createdAt: '2026-10-01T00:00:00Z',
      ...p,
    };
  }

  it('groups by when and sorts each group', () => {
    const all = [
      mk('u2', 'upcoming', '2026-10-20'),
      mk('p1', 'past', '2026-10-01'),
      mk('u1b', 'upcoming', '2026-10-15', { time: '19:00' }),
      mk('t2', 'today', '2026-10-13'),
      mk('u1a', 'upcoming', '2026-10-15', { time: '09:00' }),
      mk('p2', 'past', '2026-10-10'),
      mk('t1', 'today', '2026-10-11'),
    ];
    const s = splitBookings(all);
    expect(s.today.map((b) => b.id)).toEqual(['t1', 't2']);
    expect(s.upcoming.map((b) => b.id)).toEqual(['u1a', 'u1b', 'u2']);
    expect(s.past.map((b) => b.id)).toEqual(['p2', 'p1']);
  });

  it('breaks ties with createdAt (oldest first ahead, newest first behind)', () => {
    const s = splitBookings([
      mk('ub', 'upcoming', '2026-10-15', { createdAt: '2026-10-02T00:00:00Z' }),
      mk('ua', 'upcoming', '2026-10-15', { createdAt: '2026-10-01T00:00:00Z' }),
      mk('pa', 'past', '2026-10-01', { createdAt: '2026-09-01T00:00:00Z' }),
      mk('pb', 'past', '2026-10-01', { createdAt: '2026-09-02T00:00:00Z' }),
    ]);
    expect(s.upcoming.map((b) => b.id)).toEqual(['ua', 'ub']);
    expect(s.past.map((b) => b.id)).toEqual(['pb', 'pa']);
  });

  it('a missing createdAt sorts last on a tie, ahead and behind', () => {
    const s = splitBookings([
      mk('un', 'upcoming', '2026-10-15', { createdAt: null }),
      mk('ua', 'upcoming', '2026-10-15', { createdAt: '2026-10-01T00:00:00Z' }),
      mk('pn', 'past', '2026-10-01', { createdAt: null }),
      mk('pa', 'past', '2026-10-01', { createdAt: '2026-09-01T00:00:00Z' }),
      mk('pb', 'past', '2026-10-01', { createdAt: '2026-09-02T00:00:00Z' }),
    ]);
    expect(s.upcoming.map((b) => b.id)).toEqual(['ua', 'un']);
    expect(s.past.map((b) => b.id)).toEqual(['pb', 'pa', 'pn']);
  });

  it('does not mutate its input', () => {
    const all = [mk('b', 'past', '2026-10-01'), mk('a', 'past', '2026-10-05')];
    splitBookings(all);
    expect(all.map((b) => b.id)).toEqual(['b', 'a']);
  });
});
