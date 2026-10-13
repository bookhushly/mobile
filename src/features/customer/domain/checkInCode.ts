import type { HotelBookingRow } from '@/features/customer/schemas/bookings';

/**
 * C10: paid, not cancelled, and a code exists. Stricter than the web: hidden after check-out
 * too (the web still shows it).
 */
export function showCheckInCode(
  row: Pick<HotelBookingRow, 'payment_status' | 'booking_status' | 'check_in_code'>,
): boolean {
  if (row.payment_status !== 'completed') return false;
  if (row.booking_status === 'cancelled' || row.booking_status === 'checked_out') return false;
  return row.check_in_code !== null && row.check_in_code.trim() !== '';
}

export function spacedCode(code: string): string {
  const c = code.trim();
  return c.length === 8 ? `${c.slice(0, 4)} ${c.slice(4)}` : c;
}
