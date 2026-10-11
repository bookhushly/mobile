import {
  canChangeStatus,
  filterRooms,
  reassignCandidates,
  ROOM_STATUS_LABEL,
  roomCounts,
  SETTABLE_STATUSES,
} from '@/features/receptionist/domain/roomBoard';
import type { RoomRow, RoomStatus } from '@/features/receptionist/schemas/desk';

function room(
  id: string,
  room_number: number,
  floor: number | null,
  status: RoomStatus,
  room_type_id: string | null = 't1',
): RoomRow {
  return {
    id,
    room_number,
    floor,
    status,
    room_type_id,
    last_cleaned_at: null,
    hotel_room_types: null,
  };
}

const rooms: RoomRow[] = [
  room('r1', 204, 2, 'reserved'),
  room('r2', 101, 1, 'available'),
  room('r3', 305, 3, 'dirty'),
  room('r4', 9, null, 'available', 't2'),
  room('r5', 102, 1, 'available', 't2'),
  room('r6', 201, 2, 'dirty'),
  room('r7', 202, 2, 'available'),
];

it('roomCounts counts each status and all, with zeros for absent statuses', () => {
  expect(roomCounts(rooms)).toEqual({
    all: 7,
    available: 4,
    occupied: 0,
    dirty: 2,
    reserved: 1,
    under_maintenance: 0,
    out_of_service: 0,
  });
});

it('filterRooms sorts by floor (null last) then number, and filters by status', () => {
  expect(filterRooms(rooms, 'all').map((r) => r.id)).toEqual([
    'r2',
    'r5',
    'r6',
    'r7',
    'r1',
    'r3',
    'r4',
  ]);
  expect(filterRooms(rooms, 'dirty').map((r) => r.id)).toEqual(['r6', 'r3']);
});

it('reassignCandidates offers available rooms, same type first, never the current room', () => {
  expect(reassignCandidates(rooms, { typeId: 't1', currentRoomId: 'r2' }).map((r) => r.id)).toEqual(
    ['r7', 'r5', 'r4'],
  );
  expect(reassignCandidates(rooms, { typeId: 't2', currentRoomId: 'r1' }).map((r) => r.id)).toEqual(
    ['r5', 'r4', 'r2', 'r7'],
  );
  expect(reassignCandidates(rooms, { typeId: null, currentRoomId: null }).map((r) => r.id)).toEqual(
    ['r2', 'r5', 'r7', 'r4'],
  );
});

it('every status but occupied can be set by hand', () => {
  expect(SETTABLE_STATUSES).toEqual([
    'available',
    'dirty',
    'reserved',
    'under_maintenance',
    'out_of_service',
  ]);
  expect(canChangeStatus({ status: 'occupied' })).toBe(false);
  for (const s of SETTABLE_STATUSES) expect(canChangeStatus({ status: s })).toBe(true);
});

it('labels maintenance plainly', () => {
  expect(ROOM_STATUS_LABEL.under_maintenance).toBe('Maintenance');
});
