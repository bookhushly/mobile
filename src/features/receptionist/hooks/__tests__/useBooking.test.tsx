import { renderHook, waitFor } from '@testing-library/react-native';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { useBooking } from '@/features/receptionist/hooks/useBooking';

import { booking, deskWrapper, HOTEL, makeQueryClient } from './deskTestUtils';

jest.mock('@/features/receptionist/api/deskDb', () => ({ deskDb: { bookingById: jest.fn() } }));

let mockById: jest.SpiedFunction<typeof deskDb.bookingById>;

beforeEach(() => {
  mockById = jest.spyOn(deskDb, 'bookingById');
});

async function run(id: string) {
  const qc = makeQueryClient();
  const hook = await renderHook(() => useBooking(id), { wrapper: deskWrapper(qc) });
  expect(hook.result.current.booking).toBeUndefined();
  return {
    result: hook.result,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

it('is undefined while loading, then the booking at this hotel', async () => {
  mockById.mockResolvedValue({ ok: true, value: booking('b1') });
  const { result, done } = await run('b1');
  await waitFor(() => {
    expect(result.current.booking?.id).toBe('b1');
  });
  expect(mockById).toHaveBeenCalledWith(HOTEL, 'b1');
  expect(result.current.error).toBe(false);
  await done();
});

it('is null when the booking is not at this hotel, and errors on a failed load', async () => {
  mockById.mockResolvedValue({ ok: true, value: null });
  const missing = await run('nope');
  await waitFor(() => {
    expect(missing.result.current.booking).toBeNull();
  });
  await missing.done();

  mockById.mockResolvedValue({ ok: false, error: { kind: 'network' } });
  const failed = await run('b2');
  await waitFor(() => {
    expect(failed.result.current.error).toBe(true);
  });
  expect(failed.result.current.booking).toBeUndefined();
  await failed.done();
});
