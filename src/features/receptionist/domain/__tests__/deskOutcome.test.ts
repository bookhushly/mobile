import { deskOutcome, type DeskAct } from '@/features/receptionist/domain/deskOutcome';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const refused = (refusal: unknown) => ({ kind: 'refused', refusal });

it('passes a success body through', () => {
  expect(deskOutcome('checkIn', ok({ success: true }))).toEqual({
    kind: 'done',
    value: { success: true },
  });
});

it('a 401 means the session is gone', () => {
  expect(deskOutcome('checkIn', err({ kind: 'auth' }))).toEqual({ kind: 'signedOut' });
});

it('a 429 carries the retry hint when the server gave one', () => {
  expect(deskOutcome('checkIn', err({ kind: 'rateLimited', retryAfterSec: 12 }))).toEqual({
    kind: 'rateLimited',
    retryAfterSec: 12,
  });
  expect(deskOutcome('checkIn', err({ kind: 'rateLimited' }))).toEqual({
    kind: 'rateLimited',
    retryAfterSec: null,
  });
});

it.each<ApiError>([
  { kind: 'network' },
  { kind: 'timeout' },
  { kind: 'aborted' },
  { kind: 'validation' },
  { kind: 'unavailable', status: 500, code: 'check_in_failed' },
  { kind: 'unavailable', status: 500, code: 'unexpected' },
  { kind: 'unknown' },
])('transient or unreadable answers are uncertain, never a refusal: %p', (e) => {
  expect(deskOutcome('checkIn', err(e))).toEqual({ kind: 'uncertain' });
});

it.each<[ApiError, unknown]>([
  [{ kind: 'unknown', status: 400, code: 'cancelled' }, { kind: 'cancelled' }],
  [{ kind: 'unknown', status: 400, code: 'not_paid' }, { kind: 'unpaid' }],
  [{ kind: 'unknown', status: 400, code: 'bad_request' }, { kind: 'invalid' }],
  [{ kind: 'forbidden', code: 'forbidden' }, { kind: 'forbidden' }],
  [{ kind: 'notFound', code: 'not_found' }, { kind: 'notFound' }],
  [
    {
      kind: 'conflict',
      code: 'already_checked_in',
      body: { checked_in_at: '2026-10-11T09:42:00Z' },
    },
    { kind: 'alreadyIn', at: '2026-10-11T09:42:00Z' },
  ],
  [
    { kind: 'conflict', code: 'room_occupied', body: { room_number: 204 } },
    { kind: 'roomOccupied', roomNumber: 204 },
  ],
  [
    {
      kind: 'conflict',
      code: 'room_unavailable',
      body: { room_number: 204, room_status: 'under_maintenance' },
    },
    { kind: 'roomUnavailable', roomNumber: 204, roomStatus: 'under_maintenance' },
  ],
])('check-in refusal %p', (e, refusal) => {
  expect(deskOutcome('checkIn', err(e))).toEqual(refused(refusal));
});

it.each<[ApiError, unknown]>([
  [{ kind: 'conflict', code: 'already_checked_out' }, { kind: 'alreadyOut' }],
  [{ kind: 'unknown', status: 400, code: 'not_checked_in' }, { kind: 'notCheckedIn' }],
])('check-out refusal %p', (e, refusal) => {
  expect(deskOutcome('checkOut', err(e))).toEqual(refused(refusal));
});

it.each<[ApiError, unknown]>([
  [
    { kind: 'conflict', code: 'conflict' },
    { kind: 'roomOccupied', roomNumber: null },
  ],
  [{ kind: 'unknown', status: 400 }, { kind: 'invalid' }],
])('room-status refusal %p', (e, refusal) => {
  expect(deskOutcome('roomStatus', err(e))).toEqual(refused(refusal));
});

it.each<[ApiError, unknown]>([
  [{ kind: 'conflict', code: 'conflict' }, { kind: 'roomTaken' }],
  [{ kind: 'unknown', status: 400 }, { kind: 'invalid' }],
])('reassign refusal %p', (e, refusal) => {
  expect(deskOutcome('reassign', err(e))).toEqual(refused(refusal));
});

it.each<DeskAct>(['checkIn', 'checkOut', 'reassign', 'roomStatus'])(
  'a 422 on %s is a refusal with an invalid request',
  (act) => {
    expect(deskOutcome(act, err({ kind: 'unknown', status: 422 }))).toEqual(
      refused({ kind: 'invalid' }),
    );
  },
);
