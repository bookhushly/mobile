import {
  checkIn,
  checkOut,
  DESK_TIMEOUT_MS,
  reassignRoom,
  setRoomStatus,
} from '@/features/receptionist/api/deskApi';
import type { ApiError } from '@/shared/lib/errors';
import { err, type Result } from '@/shared/lib/result';

function fake() {
  const calls: { path: string; opts: object }[] = [];
  const client = {
    request: <T>(path: string, opts: object): Promise<Result<T, ApiError>> => {
      calls.push({ path, opts });
      return Promise.resolve(err<ApiError>({ kind: 'timeout' }));
    },
  };
  return { client, calls };
}

const ID = 'b/1 2';

it('uses a 10 s timeout', () => {
  expect(DESK_TIMEOUT_MS).toBe(10_000);
});

it('check-in posts the booking id', async () => {
  const { client, calls } = fake();
  await checkIn(client, ID);
  expect(calls[0]?.path).toBe('/api/bookings/hotel/checkin');
  expect(calls[0]?.opts).toEqual(
    expect.objectContaining({
      method: 'POST',
      body: { booking_id: ID },
      timeoutMs: DESK_TIMEOUT_MS,
      schema: expect.anything() as unknown,
    }),
  );
});

it('check-out posts the booking id', async () => {
  const { client, calls } = fake();
  await checkOut(client, ID);
  expect(calls[0]?.path).toBe('/api/bookings/hotel/checkout');
  expect(calls[0]?.opts).toEqual(
    expect.objectContaining({
      method: 'POST',
      body: { booking_id: ID },
      timeoutMs: DESK_TIMEOUT_MS,
    }),
  );
});

it('reassign patches the encoded booking id with the new room', async () => {
  const { client, calls } = fake();
  await reassignRoom(client, ID, 'r1');
  expect(calls[0]?.path).toBe(`/api/bookings/hotel/${encodeURIComponent(ID)}/reassign-room`);
  expect(calls[0]?.opts).toEqual(
    expect.objectContaining({
      method: 'PATCH',
      body: { new_room_id: 'r1' },
      timeoutMs: DESK_TIMEOUT_MS,
    }),
  );
});

it('room status patches the encoded room id', async () => {
  const { client, calls } = fake();
  await setRoomStatus(client, ID, 'dirty');
  expect(calls[0]?.path).toBe(`/api/hotel/rooms/${encodeURIComponent(ID)}/status`);
  expect(calls[0]?.opts).toEqual(
    expect.objectContaining({
      method: 'PATCH',
      body: { status: 'dirty' },
      timeoutMs: DESK_TIMEOUT_MS,
    }),
  );
});

it('no action is ever marked idempotent (R3)', async () => {
  const { client, calls } = fake();
  await checkIn(client, ID);
  await checkOut(client, ID);
  await reassignRoom(client, ID, 'r1');
  await setRoomStatus(client, ID, 'available');
  expect(calls).toHaveLength(4);
  for (const c of calls) expect(c.opts).not.toHaveProperty('idempotent');
});

it('passes the client result through', async () => {
  const { client } = fake();
  expect(await checkIn(client, ID)).toEqual({ ok: false, error: { kind: 'timeout' } });
});
