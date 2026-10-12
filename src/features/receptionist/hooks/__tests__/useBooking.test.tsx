import { act, renderHook, waitFor } from '@testing-library/react-native';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { useBooking } from '@/features/receptionist/hooks/useBooking';

import { booking, deskWrapper, HOTEL, makeQueryClient } from './deskTestUtils';

jest.mock('@/features/receptionist/api/deskDb', () => ({ deskDb: { bookingById: jest.fn() } }));

let mockById: jest.SpiedFunction<typeof deskDb.bookingById>;

beforeEach(() => {
  jest.clearAllMocks();
  mockById = jest.spyOn(deskDb, 'bookingById');
});

type Read = Awaited<ReturnType<typeof deskDb.bookingById>>;

// The read is held on a deferred promise until "loading" has been asserted, so it can't land first.
async function run(id: string, answer: Read) {
  let settle: (r: Read) => void = () => undefined;
  mockById.mockReturnValue(
    new Promise<Read>((resolve) => {
      settle = resolve;
    }),
  );
  const qc = makeQueryClient();
  const hook = await renderHook(() => useBooking(id), { wrapper: deskWrapper(qc) });
  expect(hook.result.current.booking).toBeUndefined();
  await act(async () => {
    settle(answer);
    await Promise.resolve();
  });
  return {
    result: hook.result,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

it('is undefined while loading, then the booking at this hotel', async () => {
  const { result, done } = await run('b1', { ok: true, value: booking('b1') });
  await waitFor(() => {
    expect(result.current.booking?.id).toBe('b1');
  });
  expect(mockById).toHaveBeenCalledWith(HOTEL, 'b1');
  expect(result.current.error).toBe(false);
  await done();
});

it('is null when the booking is not at this hotel, and errors on a failed load', async () => {
  const missing = await run('nope', { ok: true, value: null });
  await waitFor(() => {
    expect(missing.result.current.booking).toBeNull();
  });
  await missing.done();

  const failed = await run('b2', { ok: false, error: { kind: 'network' } });
  await waitFor(() => {
    expect(failed.result.current.error).toBe(true);
  });
  expect(failed.result.current.booking).toBeUndefined();
  await failed.done();
});

it('a null id (not a booking id) is "no such booking" without a read', async () => {
  const qc = makeQueryClient();
  const hook = await renderHook(() => useBooking(null), { wrapper: deskWrapper(qc) });
  expect(hook.result.current.booking).toBeNull();
  expect(mockById).not.toHaveBeenCalled();
  await hook.unmount();
  qc.clear();
});
