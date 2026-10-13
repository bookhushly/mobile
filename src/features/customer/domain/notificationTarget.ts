import type { BookingKind, MyBooking } from '@/features/customer/domain/myBookings';
import type { NotificationRow } from '@/features/customer/schemas/notifications';

export type NotificationTarget =
  | { kind: 'booking'; bookingKind: BookingKind; id: string }
  | { kind: 'tab'; tab: 'bookings' | 'account' }
  | null;

const CUSTOMER = '/dashboard/customer';
const ACCOUNT_PATHS = ['/dashboard/customer/profile', '/dashboard/customer/settings', '/settings'];

/** The booking a notification is about (`data.bookingId` / `data.booking_id`), if any. */
export function notificationBookingId(n: NotificationRow): string | null {
  return bookingIdOf(n.data);
}

function bookingIdOf(data: NotificationRow['data']): string | null {
  const v = data?.bookingId ?? data?.booking_id;
  return typeof v === 'string' && v !== '' ? v : null;
}

// Web links are paths; tolerate an absolute URL by reading its path. Query and hash don't matter.
function pathOf(link: string): string | null {
  const s = link.trim().replace(/^https?:\/\/[^/]+/i, '');
  if (!s.startsWith('/')) return null;
  return s.replace(/[?#].*$/, '').replace(/\/+$/, '') || '/';
}

const under = (path: string, base: string): boolean => path === base || path.startsWith(`${base}/`);

export function notificationTarget(
  n: NotificationRow,
  myBookings: readonly MyBooking[],
): NotificationTarget {
  const id = bookingIdOf(n.data);
  const hit = id === null ? undefined : myBookings.find((b) => b.id === id);
  if (hit !== undefined) return { kind: 'booking', bookingKind: hit.kind, id: hit.id };

  const path = n.link === null ? null : pathOf(n.link);
  if (path === null) return null;
  if (ACCOUNT_PATHS.some((p) => under(path, p))) return { kind: 'tab', tab: 'account' };
  if (under(path, CUSTOMER)) return { kind: 'tab', tab: 'bookings' };
  return null;
}
