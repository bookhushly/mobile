import { z } from 'zod';

import type { CheckInCode } from '@/features/receptionist/domain/checkInCode';
import {
  BOOKING_COLUMNS,
  bookingRow,
  ROOM_COLUMNS,
  roomRow,
  STAFF_COLUMNS,
  staffHotelRow,
  type BookingRow,
  type RoomRow,
  type StaffHotelRow,
} from '@/features/receptionist/schemas/desk';
import { dbErrorToApiError } from '@/shared/lib/dbError';
import type { ApiError } from '@/shared/lib/errors';
import type { IsoDate } from '@/shared/lib/lagosDay';
import { err, ok, type Result } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';
import { wrap } from '@/shared/supabase/wrap';

type DbRow = { data: unknown; error: { code?: string } | null; status: number };

// The slice of the supabase-js builder the desk uses; tests pass a fake.
export type DeskQuery = PromiseLike<DbRow> & {
  eq(column: string, value: string): DeskQuery;
  or(filters: string): DeskQuery;
  order(column: string, opts?: { ascending: boolean }): DeskQuery;
  limit(count: number): DeskQuery;
  maybeSingle(): PromiseLike<DbRow>;
};
export type SupabaseLike = {
  from(table: string): { select(columns: string): DeskQuery };
};

export type DeskDb = {
  staffHotels(userId: string): Promise<Result<StaffHotelRow[], ApiError>>;
  guests(hotelId: string, today: IsoDate): Promise<Result<BookingRow[], ApiError>>;
  bookingByCode(hotelId: string, code: CheckInCode): Promise<Result<BookingRow | null, ApiError>>;
  bookingById(hotelId: string, id: string): Promise<Result<BookingRow | null, ApiError>>;
  rooms(hotelId: string): Promise<Result<RoomRow[], ApiError>>;
};

const staffRows = z.array(staffHotelRow);
const bookingRows = z.array(bookingRow);
const roomRows = z.array(roomRow);
const maybeBooking = bookingRow.nullable();

async function read<T>(q: PromiseLike<DbRow>, schema: z.ZodType<T>): Promise<Result<T, ApiError>> {
  const r = await wrap(q);
  if (r.error) return err(dbErrorToApiError(r.error));
  const p = schema.safeParse(r.data);
  return p.success ? ok(p.data) : err({ kind: 'validation' });
}

// RLS reads: explicit columns only (R19). Only validated values are interpolated into filters —
// `today` comes from lagosToday; codes and ids go through `.eq`.
export function createDeskDb(client: SupabaseLike): DeskDb {
  const bookings = (hotelId: string) =>
    client.from('hotel_bookings').select(BOOKING_COLUMNS).eq('hotel_id', hotelId);
  return {
    staffHotels: (userId) =>
      read(client.from('hotel_staff').select(STAFF_COLUMNS).eq('user_id', userId), staffRows),
    // In house (incl. legacy rows with no booking_status but checked_in), plus today's paid
    // arrivals. Newest check-in first so the cap drops the oldest rows; splitGuests re-sorts.
    guests: (hotelId, today) =>
      read(
        bookings(hotelId)
          .or(
            `booking_status.eq.checked_in,and(booking_status.is.null,checked_in.is.true),and(booking_status.eq.confirmed,payment_status.eq.completed,check_in_date.lte.${today},check_out_date.gte.${today})`,
          )
          .order('check_in_date', { ascending: false })
          .limit(500),
        bookingRows,
      ),
    bookingByCode: (hotelId, code) =>
      read(bookings(hotelId).eq('check_in_code', code).maybeSingle(), maybeBooking),
    bookingById: (hotelId, id) => read(bookings(hotelId).eq('id', id).maybeSingle(), maybeBooking),
    rooms: (hotelId) =>
      read(
        client
          .from('hotel_rooms')
          .select(ROOM_COLUMNS)
          .eq('hotel_id', hotelId)
          .order('floor')
          .order('room_number')
          .limit(1000),
        roomRows,
      ),
  };
}

// Pinning the result type to `unknown` stops supabase-js parsing the column string at the type
// level (excessively deep for an untyped client); rows are validated with zod in `read` anyway.
const live: SupabaseLike = {
  from: (table) => ({ select: (columns) => supabase.from(table).select<string, unknown>(columns) }),
};
export const deskDb: DeskDb = createDeskDb(live);
