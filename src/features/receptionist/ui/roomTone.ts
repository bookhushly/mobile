import { ROOM_STATUS_LABEL } from '@/features/receptionist/domain/roomBoard';
import type { RoomRow, RoomStatus } from '@/features/receptionist/schemas/desk';
import { lagosTime, lagosToday, type IsoDate } from '@/shared/lib/lagosDay';
import type { ColorRole, StatusTone } from '@/shared/theme';

// Room status = dot + word in its tone, never colour alone (DESIGN_SYSTEM §10).
const TONE: Record<RoomStatus, StatusTone> = {
  available: 'success',
  occupied: 'info',
  dirty: 'warning',
  reserved: 'neutral',
  under_maintenance: 'warning',
  out_of_service: 'danger',
};

export const TONE_FG: Record<StatusTone, ColorRole> = {
  neutral: 'neutralFg',
  info: 'infoFg',
  success: 'successFg',
  warning: 'warningFg',
  danger: 'dangerFg',
};

export function roomTone(status: RoomStatus): StatusTone {
  return TONE[status];
}

export const roomTitle = (r: Pick<RoomRow, 'room_number'>) => `Room ${String(r.room_number)}`;

/** "Deluxe · Floor 2"; either part may be missing. */
export function roomPlace(r: RoomRow): string {
  const type = r.hotel_room_types?.name;
  return [
    type === undefined || type === '' ? null : type,
    r.floor === null ? null : `Floor ${String(r.floor)}`,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
}

/** "Cleaned 09:12" when the room was last cleaned on the desk's day (Lagos), else null. */
export function cleanedToday(r: RoomRow, today: IsoDate): string | null {
  const at = r.last_cleaned_at;
  if (at === null) return null;
  const ms = Date.parse(at);
  if (!Number.isFinite(ms) || lagosToday(ms) !== today) return null;
  return `Cleaned ${lagosTime(at)}`;
}

// For sentences: "No rooms are under maintenance right now.", "Room 204 marked dirty".
const PHRASE: Record<RoomStatus, string> = {
  available: 'available',
  occupied: 'occupied',
  dirty: 'dirty',
  reserved: 'reserved',
  under_maintenance: 'under maintenance',
  out_of_service: 'out of service',
};

export function statusPhrase(status: RoomStatus): string {
  return PHRASE[status];
}

export function statusLabel(status: RoomStatus): string {
  return ROOM_STATUS_LABEL[status];
}
