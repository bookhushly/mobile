import { act, renderHook, waitFor } from '@testing-library/react-native';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { useGuests } from '@/features/receptionist/hooks/useGuests';

import { booking, deskWrapper, HOTEL, makeQueryClient, TODAY } from './deskTestUtils';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/features/receptionist/api/deskDb', () => ({ deskDb: { guests: jest.fn() } }));

let mockGuests: jest.SpiedFunction<typeof deskDb.guests>;

beforeEach(() => {
  jest.clearAllMocks();
  mockGuests = jest.spyOn(deskDb, 'guests');
});

async function run() {
  const qc = makeQueryClient();
  const hook = await renderHook(() => useGuests(), { wrapper: deskWrapper(qc) });
  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });
  return {
    result: hook.result,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

it('loads the hotel guests for today and splits them into lists', async () => {
  mockGuests.mockResolvedValue({
    ok: true,
    value: [
      booking('a'),
      booking('b', {
        booking_status: 'checked_in',
        checked_in: true,
        check_out_date: TODAY,
        hotel_rooms: {
          id: 'r1',
          room_number: 101,
          floor: 1,
          status: 'occupied',
          room_type_id: null,
          hotel_room_types: null,
        },
      }),
    ],
  });
  const { result, done } = await run();
  expect(mockGuests).toHaveBeenCalledWith(HOTEL, TODAY);
  expect(result.current.error).toBe(false);
  expect(result.current.rows).toHaveLength(2);
  expect(result.current.lists?.arriving.map((b) => b.id)).toEqual(['a']);
  expect(result.current.lists?.inHouse.map((b) => b.id)).toEqual(['b']);
  expect(result.current.lists?.leaving.map((b) => b.id)).toEqual(['b']);
  expect(result.current.updatedAt).toBeGreaterThan(0);
  await done();
});

it('reports an error with no rows when the first load fails', async () => {
  mockGuests.mockResolvedValue({ ok: false, error: { kind: 'network' } });
  const { result, done } = await run();
  expect(result.current.error).toBe(true);
  expect(result.current.lists).toBeNull();
  expect(result.current.rows).toEqual([]);
  expect(result.current.updatedAt).toBe(0);
  await done();
});

it('keeps the rows on screen when a background refetch fails', async () => {
  mockGuests.mockResolvedValue({ ok: true, value: [booking('a')] });
  const { result, done } = await run();
  expect(result.current.rows).toHaveLength(1);

  mockGuests.mockResolvedValue({ ok: false, error: { kind: 'unavailable', status: 503 } });
  await act(() => {
    result.current.refetch();
  });
  await waitFor(() => {
    expect(result.current.error).toBe(true);
  });
  expect(result.current.rows).toHaveLength(1);
  expect(result.current.lists?.arriving).toHaveLength(1);
  expect(result.current.loading).toBe(false);
  await done();
});
