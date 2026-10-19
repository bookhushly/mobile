import { z } from 'zod';

import { isIsoDate } from '@/shared/lib/lagosDay';

// Explicit columns only: no contact details or `users.*` (C2, R19). The one money column is the
// booking's own `total_amount`, shown on its details screen; it is never saved to the wallet.
export const EVENT_BOOKING_COLUMNS =
  'id, status, payment_status, total_amount, booking_date, booking_time, guests, ticket_details, seat_assignments, created_at, listing:listing_id ( id, title, location, media_urls, event_date, event_end_date, event_time, require_dynamic_ticket ), tickets:event_tickets ( id, ticket_type, ticket_index, checked_in_at )';
export const HOTEL_BOOKING_COLUMNS =
  'id, check_in_date, check_out_date, adults, children, payment_status, total_amount, booking_status, checked_in, checked_in_at, checked_out_at, check_in_code, created_at, hotel:hotel_id ( id, name, city, state, address, image_urls, check_in_time, check_out_time ), room_type:room_type_id ( id, name )';
export const APARTMENT_BOOKING_COLUMNS =
  'id, check_in_date, check_out_date, number_of_nights, number_of_guests, payment_status, total_amount, booking_status, checked_in_at, checked_out_at, created_at, apartment:apartment_id ( id, name, city, state, area, address, image_urls, check_in_time, check_out_time )';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isIsoDate, 'Not a calendar date');
// `listings.event_date` is a `timestamp`: "2026-10-18T00:00:00". Only its calendar date matters.
const dateLike = z.string().refine((s) => isIsoDate(s.slice(0, 10)), 'Not a calendar date');
// Postgres `time`: "19:00:00" (or "19:00").
const clock = z.string().nullable();
const urls = z.array(z.string()).nullable();
// `numeric`: PostgREST sends a number (a string is tolerated). Display only: anything unreadable
// is null rather than failing the booking (hotel_bookings.total_amount is itself nullable).
const money = z
  .union([
    z.number(),
    z
      .string()
      .regex(/^-?\d+(\.\d+)?$/)
      .transform(Number),
  ])
  .refine(Number.isFinite)
  .nullable()
  .catch(null);

// `hotel_rooms.room_number`: text in the schema, a number in the contract's example. Display only.
const roomNumber = z
  .union([z.string(), z.number().transform(String)])
  .nullable()
  .catch(null);

export const eventTicket = z.object({
  id: z.string(),
  ticket_type: z.string(),
  ticket_index: z.number().int(),
  checked_in_at: z.string().nullable(),
});
export type EventTicketRow = z.infer<typeof eventTicket>;

export const eventBookingRow = z.object({
  id: z.string(),
  status: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).nullable(),
  payment_status: z.enum(['pending', 'completed', 'failed', 'refunded']).nullable(),
  total_amount: money,
  booking_date: isoDate,
  booking_time: clock,
  guests: z.number().int().nullable(),
  // Legacy rows hold a JSON string here; never fail the whole booking over display-only data.
  ticket_details: z.record(z.string(), z.number()).nullable().catch(null),
  seat_assignments: z
    .array(z.looseObject({ seat: z.string().nullish() }))
    .nullable()
    .catch(null),
  created_at: z.string().nullable(),
  listing: z
    .object({
      id: z.string(),
      // Nullable for `/api/bookings/mine`, which sends `title ?? null`.
      title: z.string().nullable(),
      location: z.string().nullable(),
      media_urls: urls,
      event_date: dateLike.nullable(),
      // `date` (multi-day events); same calendar-date handling as `event_date`.
      event_end_date: dateLike.nullable(),
      // `timestamptz` instant of the start, e.g. "2026-10-18T18:00:00+00:00".
      event_time: z.string().nullable(),
      require_dynamic_ticket: z.boolean().nullable(),
    })
    .nullable(),
  tickets: z.array(eventTicket).nullable(),
});
export type EventBookingRow = z.infer<typeof eventBookingRow>;

export const hotelBookingRow = z.object({
  id: z.string(),
  check_in_date: isoDate,
  check_out_date: isoDate,
  adults: z.number().int().nullable(),
  children: z.number().int().nullable(),
  payment_status: z.enum(['pending', 'completed', 'refunded', 'failed']).nullable(),
  total_amount: money,
  booking_status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled']).nullable(),
  checked_in: z.boolean().nullable(),
  checked_in_at: z.string().nullable(),
  checked_out_at: z.string().nullable(),
  check_in_code: z.string().nullable(),
  created_at: z.string().nullable(),
  hotel: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      address: z.string().nullable(),
      image_urls: urls,
      check_in_time: clock,
      check_out_time: clock,
    })
    .nullable(),
  room_type: z.object({ id: z.string(), name: z.string().nullable() }).nullable(),
  // Only `/api/bookings/mine` has it (customers can't read `hotel_rooms`, §7).
  room_number: roomNumber.optional(),
});
export type HotelBookingRow = z.infer<typeof hotelBookingRow>;

export const apartmentBookingRow = z.object({
  id: z.string(),
  check_in_date: isoDate,
  check_out_date: isoDate,
  number_of_nights: z.number().int().nullable(),
  number_of_guests: z.number().int().nullable(),
  payment_status: z
    .enum(['pending', 'paid', 'failed', 'refunded', 'partially_refunded'])
    .nullable(),
  total_amount: money,
  booking_status: z
    .enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'])
    .nullable(),
  checked_in_at: z.string().nullable(),
  checked_out_at: z.string().nullable(),
  created_at: z.string().nullable(),
  apartment: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      area: z.string().nullable(),
      address: z.string().nullable(),
      image_urls: urls,
      check_in_time: clock,
      check_out_time: clock,
    })
    .nullable(),
});
export type ApartmentBookingRow = z.infer<typeof apartmentBookingRow>;

// ── GET /api/bookings/mine (contract: web docs/mobile/CUSTOMER_BOOKINGS_API.md §1) ─────────────────
// Parsed into the RLS row shapes above, so mapping and the wallet stay the same. `/mine` sends one
// `image` instead of the URL arrays, and lacks a few display fields (null here).

const image = z.string().nullable().catch(null);
const imageUrls = (i: string | null): string[] | null => (i === null ? null : [i]);

export const mineEventRow = eventBookingRow
  .omit({ listing: true })
  .extend({
    listing: z
      .object({
        id: z.string(),
        title: z.string().nullable(),
        image,
        location: z.string().nullable(),
        event_date: dateLike.nullable(),
        event_time: z.string().nullable(),
        require_dynamic_ticket: z.boolean().nullable(),
      })
      .nullable(),
  })
  .transform(({ listing: l, ...row }): EventBookingRow => ({
    ...row,
    listing:
      l === null
        ? null
        : {
            id: l.id,
            title: l.title,
            location: l.location,
            media_urls: imageUrls(l.image),
            event_date: l.event_date,
            event_end_date: null,
            event_time: l.event_time,
            require_dynamic_ticket: l.require_dynamic_ticket,
          },
  }));

export const mineHotelRow = hotelBookingRow
  .omit({ hotel: true, checked_in: true })
  .extend({
    hotel: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        city: z.string().nullable(),
        state: z.string().nullable(),
        image,
      })
      .nullable(),
    room_number: roomNumber,
  })
  .transform(({ hotel: h, ...row }): HotelBookingRow => ({
    ...row,
    checked_in: null,
    hotel:
      h === null
        ? null
        : {
            id: h.id,
            name: h.name,
            city: h.city,
            state: h.state,
            address: null,
            image_urls: imageUrls(h.image),
            check_in_time: null,
            check_out_time: null,
          },
  }));

export const mineApartmentRow = apartmentBookingRow
  .omit({ apartment: true })
  .extend({
    apartment: z
      .object({
        id: z.string(),
        name: z.string().nullable(),
        city: z.string().nullable(),
        state: z.string().nullable(),
        area: z.string().nullable(),
        image,
      })
      .nullable(),
  })
  .transform(({ apartment: a, ...row }): ApartmentBookingRow => ({
    ...row,
    apartment:
      a === null
        ? null
        : {
            id: a.id,
            name: a.name,
            city: a.city,
            state: a.state,
            area: a.area,
            address: null,
            image_urls: imageUrls(a.image),
            check_in_time: null,
            check_out_time: null,
          },
  }));

export type MineBookings = {
  events: EventBookingRow[];
  hotels: HotelBookingRow[];
  apartments: ApartmentBookingRow[];
};

// The whole body: all three lists are asked for, so all three must be there.
export const mineBody = z.object({
  events: z.array(mineEventRow),
  hotels: z.array(mineHotelRow),
  apartments: z.array(mineApartmentRow),
});
