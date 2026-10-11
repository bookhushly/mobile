import { z } from 'zod';

export const ROOM_STATUSES = [
  'available',
  'occupied',
  'dirty',
  'reserved',
  'under_maintenance',
  'out_of_service',
] as const;
export const roomStatus = z.enum(ROOM_STATUSES);
export type RoomStatus = z.infer<typeof roomStatus>;

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const roomType = z.object({ name: z.string() }).nullable();

// Explicit columns only (R19). Keep in sync with deskDb's select strings.
export const BOOKING_COLUMNS =
  'id, guest_name, guest_phone, check_in_date, check_out_date, adults, children, booking_status, payment_status, checked_in, checked_in_at, checked_out_at, check_in_code, special_requests, hotel_rooms ( id, room_number, floor, status, room_type_id, hotel_room_types ( name ) )';

export const bookingRoom = z
  .object({
    id: z.string(),
    room_number: z.number().int(),
    floor: z.number().int().nullable(),
    status: roomStatus,
    room_type_id: z.string().nullable(),
    hotel_room_types: roomType,
  })
  .nullable();

export const bookingRow = z.object({
  id: z.string(),
  guest_name: z.string().nullable(),
  guest_phone: z.string().nullable(),
  check_in_date: isoDate,
  check_out_date: isoDate,
  adults: z.number().int().nullable(),
  children: z.number().int().nullable(),
  booking_status: z.enum(['confirmed', 'checked_in', 'checked_out', 'cancelled']).nullable(),
  payment_status: z.enum(['pending', 'completed', 'refunded', 'failed']).nullable(),
  checked_in: z.boolean().nullable(),
  checked_in_at: z.string().nullable(),
  checked_out_at: z.string().nullable(),
  check_in_code: z.string().nullable(),
  special_requests: z.string().nullable(),
  hotel_rooms: bookingRoom,
});
export type BookingRow = z.infer<typeof bookingRow>;

export const ROOM_COLUMNS =
  'id, room_number, floor, status, room_type_id, last_cleaned_at, hotel_room_types ( name )';
export const roomRow = z.object({
  id: z.string(),
  room_number: z.number().int(),
  floor: z.number().int().nullable(),
  status: roomStatus,
  room_type_id: z.string().nullable(),
  last_cleaned_at: z.string().nullable(),
  hotel_room_types: roomType,
});
export type RoomRow = z.infer<typeof roomRow>;

export const STAFF_COLUMNS = 'hotel_id, hotels ( id, name, city, state )';
export const staffHotelRow = z.object({
  hotel_id: z.string(),
  hotels: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string().nullable(),
      state: z.string().nullable(),
    })
    .nullable(),
});
export type StaffHotelRow = z.infer<typeof staffHotelRow>;

// Action bodies (BACKEND_STATUS §4).
export const checkInOk = z.object({ success: z.literal(true) });
export const checkOutOk = z.object({
  success: z.literal(true),
  hours_stayed: z.number().optional(),
});
export const reassignOk = z.object({
  success: z.literal(true),
  room_number: z.number().int().nullable().optional(),
});
export const roomStatusOk = z.object({ success: z.literal(true) });
export const alreadyCheckedInBody = z.object({ checked_in_at: z.string().nullable().optional() });
export const roomConflictBody = z.object({
  room_number: z.number().int().nullable().optional(),
  room_status: z.string().optional(),
});
