import { bookingRow } from '@/features/receptionist/schemas/desk';

const full = {
  id: 'b1',
  guest_name: 'Ada Obi',
  guest_phone: '+2348031234821',
  check_in_date: '2026-10-11',
  check_out_date: '2026-10-14',
  adults: 2,
  children: 0,
  booking_status: 'confirmed',
  payment_status: 'completed',
  checked_in: false,
  checked_in_at: null,
  checked_out_at: null,
  check_in_code: 'AB12CD34',
  special_requests: null,
  hotel_rooms: {
    id: 'r1',
    room_number: 204,
    floor: 2,
    status: 'reserved',
    room_type_id: 't1',
    hotel_room_types: { name: 'Deluxe' },
  },
};

it('parses a full booking row', () => {
  const r = bookingRow.safeParse(full);
  expect(r.success).toBe(true);
  if (r.success) expect(r.data.hotel_rooms?.room_number).toBe(204);
});

it('parses a row without a room', () => {
  expect(bookingRow.safeParse({ ...full, hotel_rooms: null }).success).toBe(true);
});

it('rejects a booking_status the DB constraint does not allow', () => {
  expect(bookingRow.safeParse({ ...full, booking_status: 'completed' }).success).toBe(false);
});

it('rejects a date that does not exist on the calendar', () => {
  expect(bookingRow.safeParse({ ...full, check_in_date: '2026-02-30' }).success).toBe(false);
});
