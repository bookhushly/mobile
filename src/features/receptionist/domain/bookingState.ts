import type { BookingRow, RoomStatus } from '@/features/receptionist/schemas/desk';
import { daysBetween, type IsoDate } from '@/shared/lib/lagosDay';

export type Stage =
  | 'arriving'
  | 'early'
  | 'overdue'
  | 'unpaid'
  | 'cancelled'
  | 'inHouse'
  | 'dueOut'
  | 'overdueOut'
  | 'checkedOut';
export type DeskAction = 'checkIn' | 'checkOut' | 'reassign';
export type Warning =
  | { kind: 'earlyArrival'; days: number; date: IsoDate }
  | { kind: 'earlyCheckOut'; days: number; date: IsoDate }
  | { kind: 'roomNotReady'; roomNumber: number; status: RoomStatus };
export type Blocker =
  { kind: 'cancelled' } | { kind: 'unpaid' } | { kind: 'checkedOut'; at: string | null };
export type BookingView = {
  stage: Stage;
  actions: DeskAction[];
  warnings: Warning[];
  blocker: Blocker | null;
  nights: number;
};

export function isInHouse(b: BookingRow): boolean {
  if (b.booking_status === 'checked_in') return true;
  return b.booking_status === null && b.checked_in === true;
}

export function viewBooking(b: BookingRow, today: IsoDate): BookingView {
  const nights = Math.max(1, daysBetween(b.check_in_date, b.check_out_date));
  const base = { nights, warnings: [] as Warning[] };
  if (b.booking_status === 'cancelled') {
    return { ...base, stage: 'cancelled', actions: [], blocker: { kind: 'cancelled' } };
  }
  if (b.booking_status === 'checked_out') {
    return {
      ...base,
      stage: 'checkedOut',
      actions: [],
      blocker: { kind: 'checkedOut', at: b.checked_out_at },
    };
  }
  if (isInHouse(b)) {
    const left = daysBetween(today, b.check_out_date);
    const stage: Stage = left > 0 ? 'inHouse' : left === 0 ? 'dueOut' : 'overdueOut';
    const warnings: Warning[] =
      left > 0 ? [{ kind: 'earlyCheckOut', days: left, date: b.check_out_date }] : [];
    return { nights, stage, actions: ['checkOut'], warnings, blocker: null };
  }
  if (b.payment_status !== 'completed') {
    return { ...base, stage: 'unpaid', actions: [], blocker: { kind: 'unpaid' } };
  }
  const early = daysBetween(today, b.check_in_date);
  const stage: Stage = early > 0 ? 'early' : early < 0 ? 'overdue' : 'arriving';
  const warnings: Warning[] = [];
  if (early > 0) warnings.push({ kind: 'earlyArrival', days: early, date: b.check_in_date });
  const room = b.hotel_rooms;
  if (room && (room.status === 'under_maintenance' || room.status === 'out_of_service')) {
    warnings.push({ kind: 'roomNotReady', roomNumber: room.room_number, status: room.status });
  }
  return { nights, stage, actions: ['checkIn', 'reassign'], warnings, blocker: null };
}
