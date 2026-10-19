import { isFallback } from '@/features/customer/api/fallback';
import { fetchMyBookings } from '@/features/customer/api/myBookingsApi';
import { mineBody } from '@/features/customer/schemas/bookings';

import { fakeRequester } from './fakeRequester';

// The contract's example (web docs/mobile/CUSTOMER_BOOKINGS_API.md §1), filled in.
const mine = {
  events: [
    {
      id: 'e1',
      status: 'confirmed',
      payment_status: 'completed',
      booking_date: '2026-11-01',
      booking_time: '19:00:00',
      guests: 2,
      total_amount: 5000,
      discount_amount: 0,
      seat_assignments: [],
      ticket_details: {},
      checked_in: false,
      checked_in_at: null,
      created_at: '2026-10-01T10:00:00Z',
      listing: {
        id: 'l1',
        title: 'Afrobeats night',
        image: 'https://cdn.example/a.jpg',
        location: 'Eko Hotel',
        event_date: '2026-11-01T00:00:00',
        event_time: '2026-11-01T18:00:00+00:00',
        require_dynamic_ticket: true,
      },
      tickets: [{ id: 't1', ticket_type: 'VIP', ticket_index: 1, checked_in_at: null }],
    },
  ],
  hotels: [
    {
      id: 'h1',
      booking_status: 'confirmed',
      payment_status: 'completed',
      check_in_date: '2026-11-01',
      check_out_date: '2026-11-03',
      adults: 2,
      children: 0,
      total_price: 50000,
      total_amount: 50000,
      breakfast_total: 0,
      airport_transfer: false,
      discount_amount: 0,
      check_in_code: 'ABCD1234',
      checked_in_at: null,
      checked_out_at: null,
      created_at: '2026-10-01T10:00:00Z',
      room_number: 204,
      room_type: { id: 'rt1', name: 'Deluxe' },
      hotel: { id: 'ho1', name: 'Harbour Suites', city: 'Ikeja', state: 'Lagos', image: null },
    },
  ],
  apartments: [
    {
      id: 'a1',
      booking_status: 'confirmed',
      payment_status: 'paid',
      check_in_date: '2026-11-01',
      check_out_date: '2026-11-04',
      number_of_nights: 3,
      number_of_guests: 2,
      total_amount: 150000,
      discount_amount: 0,
      airport_transfer: false,
      checked_in_at: null,
      checked_out_at: null,
      cancelled_at: null,
      refund_status: null,
      created_at: '2026-10-01T10:00:00Z',
      apartment: {
        id: 'ap1',
        name: 'Lekki Loft',
        city: 'Lagos',
        state: 'Lagos',
        area: 'Lekki',
        image: 'https://cdn.example/l.jpg',
      },
    },
  ],
};

it('GETs /api/bookings/mine (all three lists) with the /mine schema, never idempotent', async () => {
  const { client, calls } = fakeRequester({ body: mine });
  await fetchMyBookings(client);
  expect(calls).toHaveLength(1);
  expect(calls[0]?.path).toBe('/api/bookings/mine');
  expect(calls[0]?.opts.schema).toBe(mineBody);
  expect(calls[0]?.opts.method ?? 'GET').toBe('GET');
  expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
  expect('body' in (calls[0]?.opts ?? {})).toBe(false);
});

it('passes an abort signal through', async () => {
  const { client, calls } = fakeRequester({ body: mine });
  const signal = new AbortController().signal;
  await fetchMyBookings(client, signal);
  expect(calls[0]?.opts.signal).toBe(signal);
});

it('maps /mine rows into the RLS row shapes', async () => {
  const { client } = fakeRequester({ body: mine });
  const r = await fetchMyBookings(client);
  expect(r).toEqual({
    ok: true,
    value: {
      events: [
        {
          id: 'e1',
          status: 'confirmed',
          payment_status: 'completed',
          total_amount: 5000,
          booking_date: '2026-11-01',
          booking_time: '19:00:00',
          guests: 2,
          ticket_details: {},
          seat_assignments: [],
          created_at: '2026-10-01T10:00:00Z',
          listing: {
            id: 'l1',
            title: 'Afrobeats night',
            location: 'Eko Hotel',
            media_urls: ['https://cdn.example/a.jpg'],
            event_date: '2026-11-01T00:00:00',
            event_end_date: null,
            event_time: '2026-11-01T18:00:00+00:00',
            require_dynamic_ticket: true,
          },
          tickets: [{ id: 't1', ticket_type: 'VIP', ticket_index: 1, checked_in_at: null }],
        },
      ],
      hotels: [
        {
          id: 'h1',
          check_in_date: '2026-11-01',
          check_out_date: '2026-11-03',
          adults: 2,
          children: 0,
          payment_status: 'completed',
          total_amount: 50000,
          booking_status: 'confirmed',
          checked_in: null,
          checked_in_at: null,
          checked_out_at: null,
          check_in_code: 'ABCD1234',
          created_at: '2026-10-01T10:00:00Z',
          room_number: '204',
          room_type: { id: 'rt1', name: 'Deluxe' },
          hotel: {
            id: 'ho1',
            name: 'Harbour Suites',
            city: 'Ikeja',
            state: 'Lagos',
            address: null,
            image_urls: null,
            check_in_time: null,
            check_out_time: null,
          },
        },
      ],
      apartments: [
        {
          id: 'a1',
          check_in_date: '2026-11-01',
          check_out_date: '2026-11-04',
          number_of_nights: 3,
          number_of_guests: 2,
          payment_status: 'paid',
          total_amount: 150000,
          booking_status: 'confirmed',
          checked_in_at: null,
          checked_out_at: null,
          created_at: '2026-10-01T10:00:00Z',
          apartment: {
            id: 'ap1',
            name: 'Lekki Loft',
            city: 'Lagos',
            state: 'Lagos',
            area: 'Lekki',
            address: null,
            image_urls: ['https://cdn.example/l.jpg'],
            check_in_time: null,
            check_out_time: null,
          },
        },
      ],
    },
  });
});

it('keeps hidden-listing titles and null embeds and titles', async () => {
  const e = mine.events[0];
  const h = mine.hotels[0];
  const body = {
    events: [{ ...e, listing: { ...e?.listing, title: null, image: null } }],
    hotels: [{ ...h, hotel: null, room_type: null, room_number: null }],
    apartments: [],
  };
  const { client } = fakeRequester({ body });
  const r = await fetchMyBookings(client);
  if (!r.ok || 'fallback' in r.value) throw new Error('expected rows');
  expect(r.value.events[0]?.listing?.title).toBeNull();
  expect(r.value.events[0]?.listing?.media_urls).toBeNull();
  expect(r.value.hotels[0]?.hotel).toBeNull();
  expect(r.value.hotels[0]?.room_number).toBeNull();
});

it('a missing list is a validation failure (all three are always asked for)', async () => {
  const { client } = fakeRequester({ body: { events: [], hotels: [] } });
  expect(await fetchMyBookings(client)).toEqual({ ok: false, error: { kind: 'validation' } });
});

it.each([{ kind: 'notFound' }, { kind: 'notFound', code: 'not_found' }] as const)(
  'a 404 (%p) means the deploy lacks the route: fall back to the RLS reads',
  async (error) => {
    const { client } = fakeRequester({ error });
    expect(await fetchMyBookings(client)).toEqual({ ok: true, value: { fallback: true } });
  },
);

it.each([
  { kind: 'unavailable', status: 503, code: 'fetch_failed' },
  { kind: 'auth' },
  { kind: 'rateLimited', retryAfterSec: 5 },
] as const)('other failures pass through: %p', async (error) => {
  const { client } = fakeRequester({ error });
  expect(await fetchMyBookings(client)).toEqual({ ok: false, error });
});

it('isFallback tells the fallback from rows', () => {
  expect(isFallback({ fallback: true })).toBe(true);
  expect(isFallback({ events: [], hotels: [], apartments: [] })).toBe(false);
});
