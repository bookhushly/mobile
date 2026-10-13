import type { BookingKind } from '@/features/customer/domain/myBookings';
import type { ApiError } from '@/shared/lib/errors';

// Everything under `all(userId)` belongs to one signed-in customer.
export const customerKeys = {
  all: (u: string) => ['customer', u] as const,
  bookings: (u: string) => ['customer', u, 'bookings'] as const,
  booking: (u: string, kind: BookingKind, id: string) =>
    ['customer', u, 'booking', kind, id] as const,
  notifications: (u: string) => ['customer', u, 'notifications'] as const,
  /** The bell's count (head request), apart from the list so the bell never loads 60 rows. */
  unreadCount: (u: string) => ['customer', u, 'unreadCount'] as const,
  profile: (u: string) => ['customer', u, 'profile'] as const,
  /** The offline wallet as read from disk; only loaded when a network load has failed. */
  wallet: (u: string) => ['customer', u, 'wallet'] as const,
};

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
export class CustomerLoadError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`customer load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

// C13: the notifications list polls every 60 s while on screen.
export const NOTIFICATIONS_POLL_MS = 60_000;
