import {
  guestCounts,
  isArriving,
  maskPhone,
  searchGuests,
  splitGuests,
} from '@/features/receptionist/domain/guestLists';
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
function withRoom(b: BookingRow, room_number: number | null): BookingRow {
  if (room_number === null) return { ...b, hotel_rooms: null };
  return {
    ...b,
    hotel_rooms: {
      id: `r${String(room_number)}`,
      room_number,
      floor: null,
      status: 'occupied',
      room_type_id: null,
      hotel_room_types: null,
    },
  };
}
const inHouse = (p: Partial<BookingRow> = {}) =>
  row({ booking_status: 'checked_in', checked_in: true, ...p });

describe('splitGuests', () => {
  it('arriving is confirmed, paid and in ≤ today ≤ out, sorted by date then name', () => {
    const rows = [
      row({ id: 'late', guest_name: 'Zed', check_in_date: '2026-10-10' }),
      row({ id: 'todayB', guest_name: 'Bola' }),
      row({ id: 'todayA', guest_name: 'Ada' }),
      row({ id: 'unpaid', payment_status: 'pending' }),
      row({ id: 'tomorrow', check_in_date: '2026-10-12' }),
      row({ id: 'cancelled', booking_status: 'cancelled' }),
      row({ id: 'gone', check_in_date: '2026-10-01', check_out_date: '2026-10-05' }),
      inHouse({ id: 'in' }),
    ];
    expect(splitGuests(rows, TODAY).arriving.map((b) => b.id)).toEqual([
      'late',
      'todayA',
      'todayB',
    ]);
  });

  it('inHouse is every in-house row by room number, no room last, then name', () => {
    const rows = [
      withRoom(inHouse({ id: 'noRoomB', guest_name: 'Bola' }), null),
      withRoom(inHouse({ id: 'r310' }), 310),
      withRoom(inHouse({ id: 'noRoomA', guest_name: 'Ada' }), null),
      withRoom(inHouse({ id: 'r101' }), 101),
      withRoom(inHouse({ id: 'nullStatus', booking_status: null }), 102),
      row({ id: 'arriving' }),
    ];
    expect(splitGuests(rows, TODAY).inHouse.map((b) => b.id)).toEqual([
      'r101',
      'nullStatus',
      'r310',
      'noRoomA',
      'noRoomB',
    ]);
  });

  it('leaving is in-house with out ≤ today, sorted by out date', () => {
    const rows = [
      inHouse({ id: 'later', check_out_date: '2026-10-13' }),
      inHouse({ id: 'today', check_out_date: TODAY }),
      inHouse({ id: 'overdue', check_out_date: '2026-10-09' }),
      row({ id: 'arrivingToday', check_out_date: TODAY }),
    ];
    expect(splitGuests(rows, TODAY).leaving.map((b) => b.id)).toEqual(['overdue', 'today']);
  });

  it('isArriving excludes a confirmed row already flagged checked_in', () => {
    expect(isArriving(row({ checked_in: true }), TODAY)).toBe(false);
    expect(isArriving(row(), TODAY)).toBe(true);
  });
});

it('guestCounts reports the list lengths', () => {
  const lists = splitGuests(
    [row({ id: 'a' }), inHouse({ id: 'b' }), inHouse({ id: 'c', check_out_date: TODAY })],
    TODAY,
  );
  expect(guestCounts(lists)).toEqual({ arriving: 1, inHouse: 2, leaving: 1 });
});

describe('searchGuests', () => {
  const rows = [
    row({ id: 'ada' }),
    withRoom(
      row({
        id: 'room48',
        guest_name: 'Kemi Bello',
        guest_phone: '+2347010009999',
        check_in_code: 'C0FFEE11',
      }),
      48,
    ),
  ];
  it('matches names case-insensitively', () => {
    expect(searchGuests(rows, 'ada').map((b) => b.id)).toEqual(['ada']);
    expect(searchGuests(rows, 'OBI').map((b) => b.id)).toEqual(['ada']);
  });
  it('matches phone digits only from three digits', () => {
    expect(searchGuests(rows, '4821').map((b) => b.id)).toEqual(['ada']);
    expect(searchGuests(rows, '48').map((b) => b.id)).toEqual(['room48']);
  });
  it('matches a room number exactly', () => {
    expect(searchGuests(rows, '204').map((b) => b.id)).toEqual(['ada']);
    expect(searchGuests(rows, '20')).toEqual([]);
  });
  it('matches a code prefix case-insensitively', () => {
    expect(searchGuests(rows, 'ab12').map((b) => b.id)).toEqual(['ada']);
  });
  it('returns every row for a blank query', () => {
    expect(searchGuests(rows, '')).toBe(rows);
    expect(searchGuests(rows, '  ')).toBe(rows);
  });
});

it('maskPhone keeps the last four digits', () => {
  expect(maskPhone('+2348031234821')).toBe('•••• 4821');
  expect(maskPhone(null)).toBe('');
  expect(maskPhone('12')).toBe('12');
});
