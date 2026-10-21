import {
  chargeEstimate,
  priceLines,
  reviewSummary,
  startAgainTarget,
} from '@/features/customer/domain/checkout/reviewText';
import {
  apartmentBookingRow,
  eventBookingRow,
  hotelBookingRow,
} from '@/features/customer/schemas/bookings';

const TODAY = '2026-10-21';

const hotelRow = hotelBookingRow.parse({
  id: 'b1',
  check_in_date: '2026-10-24',
  check_out_date: '2026-10-27',
  adults: 2,
  children: 1,
  payment_status: 'pending',
  total_amount: 180000,
  booking_status: 'confirmed',
  checked_in: false,
  checked_in_at: null,
  checked_out_at: null,
  check_in_code: null,
  created_at: '2026-10-21T09:00:00Z',
  hotel: {
    id: 'h1',
    name: 'Harbour Suites',
    city: 'Lagos',
    state: 'Lagos',
    address: null,
    image_urls: null,
    check_in_time: '14:00',
    check_out_time: null,
  },
  room_type: { id: 'rt1', name: 'Deluxe king' },
});

const eventRow = eventBookingRow.parse({
  id: 'e1',
  status: 'pending',
  payment_status: 'pending',
  total_amount: 20000,
  booking_date: '2026-10-21',
  booking_time: null,
  guests: 2,
  ticket_details: { VIP: 2 },
  seat_assignments: null,
  created_at: '2026-10-21T09:00:00Z',
  listing: {
    id: 'l1',
    title: 'Lagos Jazz Night',
    location: null,
    media_urls: null,
    event_date: '2026-10-30T00:00:00',
    event_end_date: null,
    event_time: '2026-10-30T18:00:00+00:00',
    require_dynamic_ticket: null,
  },
  tickets: [],
});

const aptRow = apartmentBookingRow.parse({
  id: 'a1',
  check_in_date: '2026-10-24',
  check_out_date: '2026-10-26',
  number_of_nights: 2,
  number_of_guests: 3,
  payment_status: 'pending',
  total_amount: 90000,
  booking_status: 'pending',
  checked_in_at: null,
  checked_out_at: null,
  created_at: '2026-10-21T09:00:00Z',
  apartment: {
    id: 'ap1',
    name: 'Lekki Loft',
    city: 'Lagos',
    state: 'Lagos',
    area: 'Lekki',
    address: null,
    image_urls: null,
    check_in_time: null,
    check_out_time: null,
  },
});

describe('chargeEstimate', () => {
  it('takes a percentage of the total, to 2 dp', () => {
    expect(
      chargeEstimate(10001, {
        charge_type: 'percentage',
        charge_value: 2.5,
        enabled: true,
        label: null,
      }),
    ).toEqual({ label: 'Service charge', amount: 250.03 });
  });
  it('uses a flat value with its label', () => {
    expect(
      chargeEstimate(10000, {
        charge_type: 'fixed',
        charge_value: 500,
        enabled: true,
        label: 'Fee',
      }),
    ).toEqual({ label: 'Fee', amount: 500 });
  });
  it('is omitted when null, disabled or unreadable', () => {
    expect(chargeEstimate(10000, null)).toBeNull();
    expect(
      chargeEstimate(10000, { charge_type: 'fixed', charge_value: 500, enabled: false, label: '' }),
    ).toBeNull();
    expect(
      chargeEstimate(10000, { charge_type: 'fixed', charge_value: -5, enabled: true, label: '' }),
    ).toBeNull();
  });
});

describe('priceLines', () => {
  it('lists hotel lines; the discount is already in the room total', () => {
    expect(
      priceLines('hotel', {
        room_total: 150000,
        airport_fee: 0,
        breakfast_total: 30000,
        discount_amount: 5000,
      }),
    ).toEqual({
      lines: [
        { label: 'Room', amount: 150000 },
        { label: 'Breakfast', amount: 30000 },
      ],
      discountIncluded: 5000,
    });
  });
  it('is total-only for an idempotent replay (room_total null) or no pricing', () => {
    expect(priceLines('hotel', { room_total: null, airport_fee: 0 })).toBeNull();
    expect(priceLines('event', null)).toBeNull();
    expect(priceLines('apartment', null)).toBeNull();
  });
  it('never shows an apartment discount as reducing the price', () => {
    expect(
      priceLines('apartment', {
        price_per_night: 45000,
        subtotal: 90000,
        service_fee: 0,
        caution_deposit: 20000,
        airport_fee: 15000,
        discount_amount: 9000,
      }),
    ).toEqual({
      lines: [
        { label: 'Stay', amount: 90000 },
        { label: 'Caution deposit', amount: 20000 },
        { label: 'Airport transfer', amount: 15000 },
      ],
      discountIncluded: null,
    });
  });
});

describe('reviewSummary', () => {
  it('prefers the booking row for a hotel', () => {
    expect(reviewSummary('hotel', null, hotelRow, TODAY)).toEqual({
      title: 'Harbour Suites',
      when: '24–27 Oct · 3 nights',
      extra: 'Deluxe king · 2 adults, 1 child',
    });
  });
  it('uses the cached entry while the row loads', () => {
    expect(
      reviewSummary(
        'hotel',
        {
          title: 'Harbour Suites',
          summary: { checkIn: '2026-10-24', checkOut: '2026-10-25', guests: 1, roomName: 'Twin' },
        },
        undefined,
        TODAY,
      ),
    ).toEqual({ title: 'Harbour Suites', when: '24–25 Oct · 1 night', extra: 'Twin · 1 guest' });
  });
  it('shows the event time and tickets', () => {
    const s = reviewSummary('event', null, eventRow, TODAY);
    expect(s.title).toBe('Lagos Jazz Night');
    expect(s.when).toBe('Fri 30 Oct · 7:00 pm');
    expect(s.extra).toBe('2 × VIP');
  });
  it('falls back to the entry for an event', () => {
    expect(
      reviewSummary(
        'event',
        { title: 'Jazz', summary: { eventDate: '2026-10-30T00:00:00', tickets: 3 } },
        undefined,
        TODAY,
      ),
    ).toEqual({ title: 'Jazz', when: 'Fri 30 Oct', extra: '3 tickets' });
  });
  it('apartment guests', () => {
    expect(reviewSummary('apartment', null, aptRow, TODAY).extra).toBe('3 guests');
  });
});

describe('startAgainTarget', () => {
  it('takes the listing (and room type) from the row, else the entry', () => {
    expect(startAgainTarget('hotel', null, hotelRow)).toEqual({
      kind: 'hotel',
      listingId: 'h1',
      roomTypeId: 'rt1',
    });
    expect(startAgainTarget('event', null, eventRow)).toEqual({
      kind: 'event',
      listingId: 'l1',
      roomTypeId: null,
    });
    expect(startAgainTarget('apartment', { listingId: 'ap9' }, undefined)).toEqual({
      kind: 'apartment',
      listingId: 'ap9',
      roomTypeId: null,
    });
    expect(startAgainTarget('apartment', { listingId: '' }, null)).toBeNull();
  });
});
