import type { RoomRow, RoomStatus } from '@/features/receptionist/schemas/desk';

export type RoomFilter = 'all' | RoomStatus;
export const SETTABLE_STATUSES: readonly RoomStatus[] = [
  'available',
  'dirty',
  'reserved',
  'under_maintenance',
  'out_of_service',
];
export const ROOM_STATUS_LABEL: Record<RoomStatus, string> = {
  available: 'Available',
  occupied: 'Occupied',
  dirty: 'Dirty',
  reserved: 'Reserved',
  under_maintenance: 'Maintenance',
  out_of_service: 'Out of service',
};

const floorOf = (r: RoomRow) => r.floor ?? Number.MAX_SAFE_INTEGER;
const byPlace = (a: RoomRow, b: RoomRow) =>
  floorOf(a) - floorOf(b) || a.room_number - b.room_number;

export function roomCounts(rooms: readonly RoomRow[]): Record<RoomFilter, number> {
  const counts: Record<RoomFilter, number> = {
    all: rooms.length,
    available: 0,
    occupied: 0,
    dirty: 0,
    reserved: 0,
    under_maintenance: 0,
    out_of_service: 0,
  };
  for (const r of rooms) counts[r.status] += 1;
  return counts;
}

export function filterRooms(rooms: readonly RoomRow[], f: RoomFilter): RoomRow[] {
  return rooms.filter((r) => f === 'all' || r.status === f).sort(byPlace);
}

export function canChangeStatus(r: Pick<RoomRow, 'status'>): boolean {
  return r.status !== 'occupied';
}

export function reassignCandidates(
  rooms: readonly RoomRow[],
  opts: { typeId: string | null; currentRoomId: string | null },
): RoomRow[] {
  const same = (r: RoomRow) => (opts.typeId !== null && r.room_type_id === opts.typeId ? 0 : 1);
  return rooms
    .filter((r) => r.status === 'available' && r.id !== opts.currentRoomId)
    .sort((a, b) => same(a) - same(b) || byPlace(a, b));
}
