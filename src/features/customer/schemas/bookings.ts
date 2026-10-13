import { z } from 'zod';

import { isIsoDate } from '@/shared/lib/lagosDay';

// Explicit columns only: no contact details, money or `users.*` (C2, R19).
export const EVENT_BOOKING_COLUMNS =
  'id, status, payment_status, booking_date, booking_time, guests, ticket_details, seat_assignments, created_at, listing:listing_id ( id, title, location, media_urls, event_date, event_end_date, event_time, require_dynamic_ticket ), tickets:event_tickets ( id, ticket_type, ticket_index, checked_in_at )';
export const HOTEL_BOOKING_COLUMNS =
  'id, check_in_date, check_out_date, adults, children, payment_status, booking_status, checked_in, checked_in_at, checked_out_at, check_in_code, created_at, hotel:hotel_id ( id, name, city, state, address, image_urls, check_in_time, check_out_time ), room_type:room_type_id ( id, name )';
export const APARTMENT_BOOKING_COLUMNS =
  'id, check_in_date, check_out_date, number_of_nights, number_of_guests, payment_status, booking_status, checked_in_at, checked_out_at, created_at, apartment:apartment_id ( id, name, city, state, area, address, image_urls, check_in_time, check_out_time )';

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(isIsoDate, 'Not a calendar date');
// `listings.event_date` is a `timestamp`: "2026-10-18T00:00:00". Only its calendar date matters.
const dateLike = z.string().refine((s) => isIsoDate(s.slice(0, 10)), 'Not a calendar date');
// Postgres `time`: "19:00:00" (or "19:00").
const clock = z.string().nullable();
const urls = z.array(z.string()).nullable();

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
  booking_date: isoDate,
  booking_time: clock,
  guests: z.number().int().nullable(),
  // Legacy rows hold a JSON string here; never fail the whole booking over display-only data.
  ticket_details: z.record(z.string(), z.number()).nullable().catch(null),
  seat_assignments: z
    .array(z.looseObject({ seat: z.string().nullish() }))
    .nullable()
    .catch(null),
  created_at: z.string(),
  listing: z
    .object({
      id: z.string(),
      title: z.string(),
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
  booking_status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled']).nullable(),
  checked_in: z.boolean().nullable(),
  checked_in_at: z.string().nullable(),
  checked_out_at: z.string().nullable(),
  check_in_code: z.string().nullable(),
  created_at: z.string(),
  hotel: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable(),
      state: z.string().nullable(),
      address: z.string().nullable(),
      image_urls: urls,
      check_in_time: clock,
      check_out_time: clock,
    })
    .nullable(),
  room_type: z.object({ id: z.string(), name: z.string() }).nullable(),
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
  booking_status: z
    .enum(['pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'no_show'])
    .nullable(),
  checked_in_at: z.string().nullable(),
  checked_out_at: z.string().nullable(),
  created_at: z.string(),
  apartment: z
    .object({
      id: z.string(),
      name: z.string(),
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
