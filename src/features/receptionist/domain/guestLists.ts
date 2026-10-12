import { isInHouse } from '@/features/receptionist/domain/bookingState';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import type { IsoDate } from '@/shared/lib/lagosDay';

export type GuestLists = { arriving: BookingRow[]; inHouse: BookingRow[]; leaving: BookingRow[] };
export type GuestTab = keyof GuestLists;

const byName = (a: BookingRow, b: BookingRow) =>
  (a.guest_name ?? '').localeCompare(b.guest_name ?? '');
const roomNo = (b: BookingRow) => b.hotel_rooms?.room_number ?? Number.MAX_SAFE_INTEGER;

export function isArriving(b: BookingRow, today: IsoDate): boolean {
  return (
    b.booking_status === 'confirmed' &&
    b.checked_in !== true &&
    b.payment_status === 'completed' &&
    b.check_in_date <= today &&
    b.check_out_date >= today
  );
}

export function splitGuests(rows: readonly BookingRow[], today: IsoDate): GuestLists {
  const arriving = rows
    .filter((b) => isArriving(b, today))
    .sort((a, b) => a.check_in_date.localeCompare(b.check_in_date) || byName(a, b));
  const inHouse = rows.filter(isInHouse).sort((a, b) => roomNo(a) - roomNo(b) || byName(a, b));
  const leaving = inHouse
    .filter((b) => b.check_out_date <= today)
    .sort((a, b) => a.check_out_date.localeCompare(b.check_out_date) || byName(a, b));
  return { arriving, inHouse, leaving };
}

export function guestCounts(l: GuestLists): Record<GuestTab, number> {
  return { arriving: l.arriving.length, inHouse: l.inHouse.length, leaving: l.leaving.length };
}

export function searchGuests(rows: readonly BookingRow[], query: string): readonly BookingRow[] {
  const q = query.trim();
  if (q === '') return rows;
  const lower = q.toLowerCase();
  const upper = q.toUpperCase();
  const digits = q.replace(/\D/g, '');
  return rows.filter(
    (b) =>
      (b.guest_name ?? '').toLowerCase().includes(lower) ||
      (b.check_in_code ?? '').startsWith(upper) ||
      (b.hotel_rooms !== null && String(b.hotel_rooms.room_number) === q) ||
      (digits.length >= 3 && (b.guest_phone ?? '').replace(/\D/g, '').includes(digits)),
  );
}

export function maskPhone(phone: string | null): string {
  if (phone === null) return '';
  const digits = phone.replace(/\D/g, '');
  return digits.length <= 4 ? phone : `•••• ${digits.slice(-4)}`;
}
