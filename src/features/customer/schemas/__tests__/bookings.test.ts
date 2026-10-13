import {
  APARTMENT_BOOKING_COLUMNS,
  EVENT_BOOKING_COLUMNS,
  HOTEL_BOOKING_COLUMNS,
  apartmentBookingRow,
  eventBookingRow,
  hotelBookingRow,
} from '@/features/customer/schemas/bookings';

// Shapes as PostgREST returns them (listings.event_date is `timestamp`, event_time `timestamptz`).
const event = {
  id: 'e1',
  status: 'confirmed',
  payment_status: 'completed',
  booking_date: '2026-10-18',
  booking_time: '19:00:00',
  guests: 2,
  ticket_details: { Regular: 2 },
  seat_assignments: [{ ticket_type: 'Regular', seat: 'A1' }, { ticket_type: 'Regular' }],
  created_at: '2026-10-01T10:00:00+00:00',
  listing: {
    id: 'l1',
    title: 'Afrobeats night',
    location: 'Eko Hotel, Lagos',
    media_urls: ['https://cdn.example/a.jpg'],
    event_date: '2026-10-18T00:00:00',
    event_time: '2026-10-18T18:00:00+00:00',
    event_end_date: null,
    require_dynamic_ticket: false,
  },
  tickets: [{ id: 't1', ticket_type: 'Regular', ticket_index: 1, checked_in_at: null }],
};

const hotel = {
  id: 'h1',
  check_in_date: '2026-10-15',
  check_out_date: '2026-10-17',
  adults: 2,
  children: 0,
  payment_status: 'completed',
  booking_status: 'confirmed',
  checked_in: false,
  checked_in_at: null,
  checked_out_at: null,
  check_in_code: 'AB12CD34',
  created_at: '2026-10-01T10:00:00+00:00',
  hotel: {
    id: 'ho1',
    name: 'Harbour Suites',
    city: 'Lagos',
    state: 'Lagos',
    address: '1 Marina',
    image_urls: null,
    check_in_time: '14:00:00',
    check_out_time: '12:00:00',
  },
  room_type: { id: 'rt1', name: 'Deluxe' },
};

const apartment = {
  id: 'a1',
  check_in_date: '2026-10-15',
  check_out_date: '2026-10-17',
  number_of_nights: 2,
  number_of_guests: 3,
  payment_status: 'paid',
  booking_status: 'confirmed',
  checked_in_at: null,
  checked_out_at: null,
  created_at: '2026-10-01T10:00:00+00:00',
  apartment: {
    id: 'ap1',
    name: 'Lekki Loft',
    city: 'Lagos',
    state: 'Lagos',
    area: 'Lekki',
    address: null,
    image_urls: [],
    check_in_time: '14:00:00',
    check_out_time: '12:00:00',
  },
};

describe('column lists', () => {
  it.each([
    ['event', EVENT_BOOKING_COLUMNS],
    ['hotel', HOTEL_BOOKING_COLUMNS],
    ['apartment', APARTMENT_BOOKING_COLUMNS],
  ])('%s columns read no contact, money or password fields', (_k, cols) => {
    for (const banned of ['email', 'phone', 'total', 'amount', 'password']) {
      expect(cols).not.toContain(banned);
    }
  });

  it('reads the event end date for multi-day events', () => {
    expect(EVENT_BOOKING_COLUMNS).toContain('event_date, event_end_date, event_time');
  });
});

describe('eventBookingRow', () => {
  it('parses a date-only or timestamp event_end_date', () => {
    for (const end of ['2026-10-19', '2026-10-19T00:00:00']) {
      const listingEnd = { ...event.listing, event_end_date: end };
      expect(eventBookingRow.safeParse({ ...event, listing: listingEnd }).success).toBe(true);
    }
  });

  it('parses a full row', () => {
    const r = eventBookingRow.safeParse(event);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.listing?.title).toBe('Afrobeats night');
      expect(r.data.seat_assignments?.[0]?.seat).toBe('A1');
      expect(r.data.tickets?.[0]?.ticket_index).toBe(1);
    }
  });

  it('parses a hidden listing (null embed) and null tickets', () => {
    expect(eventBookingRow.safeParse({ ...event, listing: null, tickets: null }).success).toBe(
      true,
    );
  });

  it('keeps extra seat fields and accepts a null seat', () => {
    const r = eventBookingRow.safeParse({
      ...event,
      seat_assignments: [{ ticket_type: 'VIP', seat: null, row: 'B' }],
    });
    expect(r.success).toBe(true);
  });

  it('does not fail the row on legacy ticket_details or seat shapes', () => {
    const r = eventBookingRow.safeParse({
      ...event,
      ticket_details: '{"Regular":2}',
      seat_assignments: 'oops',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.ticket_details).toBeNull();
      expect(r.data.seat_assignments).toBeNull();
    }
  });

  it('rejects a status the DB constraint does not allow', () => {
    expect(eventBookingRow.safeParse({ ...event, status: 'checked_in' }).success).toBe(false);
    expect(eventBookingRow.safeParse({ ...event, payment_status: 'paid' }).success).toBe(false);
  });

  it('rejects a booking_date that is not a calendar date', () => {
    expect(eventBookingRow.safeParse({ ...event, booking_date: '2026-02-30' }).success).toBe(false);
  });

  it('rejects an event_date that does not start with a calendar date', () => {
    const listing = { ...event.listing, event_date: 'soon' };
    expect(eventBookingRow.safeParse({ ...event, listing }).success).toBe(false);
  });
});

describe('hotelBookingRow', () => {
  it('parses a full row', () => {
    expect(hotelBookingRow.safeParse(hotel).success).toBe(true);
  });

  it('parses null embeds and a null booking_status', () => {
    expect(
      hotelBookingRow.safeParse({ ...hotel, hotel: null, room_type: null, booking_status: null })
        .success,
    ).toBe(true);
  });

  it('rejects apartment-only statuses', () => {
    expect(hotelBookingRow.safeParse({ ...hotel, booking_status: 'no_show' }).success).toBe(false);
    expect(hotelBookingRow.safeParse({ ...hotel, payment_status: 'paid' }).success).toBe(false);
  });
});

describe('apartmentBookingRow', () => {
  it('parses a full row', () => {
    expect(apartmentBookingRow.safeParse(apartment).success).toBe(true);
  });

  it('parses a hidden apartment', () => {
    expect(apartmentBookingRow.safeParse({ ...apartment, apartment: null }).success).toBe(true);
  });

  it.each(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])(
    'accepts payment_status %s',
    (s) => {
      expect(apartmentBookingRow.safeParse({ ...apartment, payment_status: s }).success).toBe(true);
    },
  );

  it('rejects completed as an apartment payment status', () => {
    expect(
      apartmentBookingRow.safeParse({ ...apartment, payment_status: 'completed' }).success,
    ).toBe(false);
  });
});
