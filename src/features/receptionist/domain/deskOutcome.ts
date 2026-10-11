import { alreadyCheckedInBody, roomConflictBody } from '@/features/receptionist/schemas/desk';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type DeskAct = 'checkIn' | 'checkOut' | 'reassign' | 'roomStatus';
export type Refusal =
  | { kind: 'cancelled' }
  | { kind: 'unpaid' }
  | { kind: 'alreadyIn'; at: string | null }
  | { kind: 'alreadyOut' }
  | { kind: 'notCheckedIn' }
  | { kind: 'roomOccupied'; roomNumber: number | null }
  | { kind: 'roomUnavailable'; roomNumber: number | null; roomStatus: string | null }
  | { kind: 'roomTaken' }
  | { kind: 'forbidden' }
  | { kind: 'notFound' }
  | { kind: 'invalid' };
export type DeskOutcome<T> =
  | { kind: 'done'; value: T }
  | { kind: 'refused'; refusal: Refusal }
  | { kind: 'uncertain' }
  | { kind: 'rateLimited'; retryAfterSec: number | null }
  | { kind: 'signedOut' };

const refused = (refusal: Refusal) => ({ kind: 'refused', refusal }) as const;

function conflict(act: DeskAct, code: string, body: unknown): Refusal {
  if (act === 'roomStatus') return { kind: 'roomOccupied', roomNumber: null };
  if (act === 'reassign') return { kind: 'roomTaken' };
  if (act === 'checkOut') {
    // A check-out can only collide with itself; any other 409 code is a request we don't know.
    return code === 'already_checked_out' ? { kind: 'alreadyOut' } : { kind: 'invalid' };
  }
  if (code === 'already_checked_in') {
    const b = alreadyCheckedInBody.safeParse(body);
    return { kind: 'alreadyIn', at: b.success ? (b.data.checked_in_at ?? null) : null };
  }
  const room = roomConflictBody.safeParse(body);
  const roomNumber = room.success ? (room.data.room_number ?? null) : null;
  if (code === 'room_unavailable') {
    const roomStatus = room.success ? (room.data.room_status ?? null) : null;
    return { kind: 'roomUnavailable', roomNumber, roomStatus };
  }
  return { kind: 'roomOccupied', roomNumber };
}

function badRequest(code: string | undefined): Refusal {
  if (code === 'cancelled') return { kind: 'cancelled' };
  if (code === 'not_paid') return { kind: 'unpaid' };
  if (code === 'not_checked_in') return { kind: 'notCheckedIn' };
  return { kind: 'invalid' };
}

export function deskOutcome<T>(act: DeskAct, r: Result<T, ApiError>): DeskOutcome<T> {
  if (r.ok) return { kind: 'done', value: r.value };
  const e = r.error;
  switch (e.kind) {
    case 'auth':
      return { kind: 'signedOut' };
    case 'rateLimited':
      return { kind: 'rateLimited', retryAfterSec: e.retryAfterSec ?? null };
    case 'forbidden':
      return refused({ kind: 'forbidden' });
    case 'notFound':
      return refused({ kind: 'notFound' });
    case 'conflict':
      return refused(conflict(act, e.code, e.body));
    case 'unknown':
      // A 4xx means the server rejected the request: nothing happened.
      if (e.status !== undefined && e.status >= 400 && e.status < 500)
        return refused(badRequest(e.code));
      return { kind: 'uncertain' };
    case 'network':
    case 'timeout':
    case 'aborted':
    case 'validation':
    case 'unavailable':
      return { kind: 'uncertain' };
  }
}
