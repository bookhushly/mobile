import type { SettableStatus } from '@/features/receptionist/domain/roomBoard';
import {
  checkInOk,
  checkOutOk,
  reassignOk,
  roomStatusOk,
} from '@/features/receptionist/schemas/desk';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export const DESK_TIMEOUT_MS = 10_000;

type Requester = Pick<ApiClient, 'request'>;

// None of these is idempotent on the server (R3): never pass `idempotent: true`, never auto re-post.
// A lost response is reconciled by re-reading the booking (domain/reconcile).

export function checkIn(
  c: Requester,
  bookingId: string,
): Promise<Result<{ success: true }, ApiError>> {
  return c.request('/api/bookings/hotel/checkin', {
    method: 'POST',
    body: { booking_id: bookingId },
    schema: checkInOk,
    timeoutMs: DESK_TIMEOUT_MS,
  });
}

export function checkOut(
  c: Requester,
  bookingId: string,
): Promise<Result<{ success: true; hours_stayed?: number }, ApiError>> {
  return c.request('/api/bookings/hotel/checkout', {
    method: 'POST',
    body: { booking_id: bookingId },
    schema: checkOutOk,
    timeoutMs: DESK_TIMEOUT_MS,
  });
}

export function reassignRoom(
  c: Requester,
  bookingId: string,
  roomId: string,
): Promise<Result<{ success: true; room_number?: number | null }, ApiError>> {
  return c.request(`/api/bookings/hotel/${encodeURIComponent(bookingId)}/reassign-room`, {
    method: 'PATCH',
    body: { new_room_id: roomId },
    schema: reassignOk,
    timeoutMs: DESK_TIMEOUT_MS,
  });
}

export function setRoomStatus(
  c: Requester,
  roomId: string,
  status: SettableStatus,
): Promise<Result<{ success: true }, ApiError>> {
  return c.request(`/api/hotel/rooms/${encodeURIComponent(roomId)}/status`, {
    method: 'PATCH',
    body: { status },
    schema: roomStatusOk,
    timeoutMs: DESK_TIMEOUT_MS,
  });
}
