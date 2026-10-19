import type { BookingKind } from '@/features/customer/domain/myBookings';
import {
  cancelBody,
  refundRequest,
  refundResult,
  transferRequest,
  transferResult,
  type CancelResult,
} from '@/features/customer/schemas/actions';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import { err, type Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

// Irreversible POSTs: never `idempotent`, so the client never re-sends one (spec E5–E7). An
// uncertain answer is resolved by re-reading the booking, not by posting again.

/** POST, no body (`public` tier). The server decides; its refusals carry codes. */
export function cancelBooking(
  c: Requester,
  kind: BookingKind,
  id: string,
): Promise<Result<CancelResult, ApiError>> {
  return c.request(`/api/bookings/${kind}/${encodeURIComponent(id)}/cancel`, {
    method: 'POST',
    schema: cancelBody,
  });
}

/** POST `{booking_id, reason}` (events only, `public` tier). No codes: statuses only. */
export function requestRefund(
  c: Requester,
  bookingId: string,
  reason: string,
): Promise<Result<{ id: string }, ApiError>> {
  const body = refundRequest.safeParse({ booking_id: bookingId, reason });
  if (!body.success) return Promise.resolve(err({ kind: 'validation' }));
  return c.request('/api/refunds/request', {
    method: 'POST',
    body: body.data,
    schema: refundResult,
  });
}

/** POST `{new_email}` (`public` tier). No codes: statuses only. */
export function transferTickets(
  c: Requester,
  bookingId: string,
  newEmail: string,
): Promise<Result<{ transferredTo: string }, ApiError>> {
  const body = transferRequest.safeParse({ new_email: newEmail });
  if (!body.success) return Promise.resolve(err({ kind: 'validation' }));
  return c.request(`/api/bookings/event/${encodeURIComponent(bookingId)}/transfer`, {
    method: 'POST',
    body: body.data,
    schema: transferResult,
  });
}
