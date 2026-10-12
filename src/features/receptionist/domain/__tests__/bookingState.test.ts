import { isInHouse, viewBooking } from '@/features/receptionist/domain/bookingState';
import type { BookingRow } from '@/features/receptionist/schemas/desk';

const TODAY = '2026-10-11';
function row(p: Partial<BookingRow> = {}): BookingRow {
  return {
    id: 'b1',
    guest_name: 'Ada Obi',
    guest_phone: '+2348031234821',
    check_in_date: TODAY,
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
    ...p,
  };
}

it('a paid, confirmed booking arriving today can be checked in or moved', () => {
  expect(viewBooking(row(), TODAY)).toEqual({
    stage: 'arriving',
    actions: ['checkIn', 'reassign'],
    blocker: null,
    warnings: [],
    nights: 3,
  });
});

it('warns when the guest arrives before the booked date', () => {
  const v = viewBooking(row({ check_in_date: '2026-10-13' }), TODAY);
  expect(v.stage).toBe('early');
  expect(v.warnings).toEqual([{ kind: 'earlyArrival', days: 2, date: '2026-10-13' }]);
  expect(v.actions).toEqual(['checkIn', 'reassign']);
});

it('is overdue when the booked arrival has passed', () => {
  expect(viewBooking(row({ check_in_date: '2026-10-09' }), TODAY).stage).toBe('overdue');
});

it('blocks an unpaid booking', () => {
  const v = viewBooking(row({ payment_status: 'pending' }), TODAY);
  expect(v.stage).toBe('unpaid');
  expect(v.blocker).toEqual({ kind: 'unpaid' });
  expect(v.actions).toEqual([]);
});

it('blocks a cancelled booking', () => {
  const v = viewBooking(row({ booking_status: 'cancelled' }), TODAY);
  expect(v.stage).toBe('cancelled');
  expect(v.blocker).toEqual({ kind: 'cancelled' });
  expect(v.actions).toEqual([]);
});

it('an in-house guest leaving later can only be checked out, with an early warning', () => {
  const v = viewBooking(
    row({ booking_status: 'checked_in', checked_in: true, check_out_date: '2026-10-14' }),
    TODAY,
  );
  expect(v.stage).toBe('inHouse');
  expect(v.actions).toEqual(['checkOut']);
  expect(v.warnings).toEqual([{ kind: 'earlyCheckOut', days: 3, date: '2026-10-14' }]);
});

it('is due out today and overdue out after', () => {
  const due = viewBooking(
    row({ booking_status: 'checked_in', checked_in: true, check_out_date: TODAY }),
    TODAY,
  );
  expect(due.stage).toBe('dueOut');
  expect(due.warnings).toEqual([]);
  const late = viewBooking(
    row({ booking_status: 'checked_in', checked_in: true, check_out_date: '2026-10-10' }),
    TODAY,
  );
  expect(late.stage).toBe('overdueOut');
});

it('a checked-out booking is blocked with the time it left', () => {
  const v = viewBooking(
    row({ booking_status: 'checked_out', checked_out_at: '2026-10-11T09:00:00Z' }),
    TODAY,
  );
  expect(v.stage).toBe('checkedOut');
  expect(v.blocker).toEqual({ kind: 'checkedOut', at: '2026-10-11T09:00:00Z' });
});

it('treats a null status with checked_in true as in house', () => {
  const b = row({ booking_status: null, checked_in: true });
  expect(isInHouse(b)).toBe(true);
  expect(viewBooking(b, TODAY).actions).toEqual(['checkOut']);
});

it('warns, but does not block, when the room is not ready', () => {
  const v = viewBooking(
    row({
      hotel_rooms: {
        id: 'r1',
        room_number: 204,
        floor: 2,
        status: 'under_maintenance',
        room_type_id: 't1',
        hotel_room_types: { name: 'Deluxe' },
      },
    }),
    TODAY,
  );
  expect(v.warnings).toContainEqual({
    kind: 'roomNotReady',
    roomNumber: 204,
    status: 'under_maintenance',
  });
  expect(v.blocker).toBeNull();
  expect(v.actions).toEqual(['checkIn', 'reassign']);
});

it('counts a same-day stay as one night', () => {
  expect(viewBooking(row({ check_out_date: TODAY }), TODAY).nights).toBe(1);
});
