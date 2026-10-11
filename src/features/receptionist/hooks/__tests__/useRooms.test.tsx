import { renderHook, waitFor } from '@testing-library/react-native';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { useRooms } from '@/features/receptionist/hooks/useRooms';
import type { RoomRow } from '@/features/receptionist/schemas/desk';

import { deskWrapper, HOTEL, makeQueryClient } from './deskTestUtils';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/features/receptionist/api/deskDb', () => ({ deskDb: { rooms: jest.fn() } }));

const room: RoomRow = {
  id: 'r1',
  room_number: 101,
  floor: 1,
  status: 'available',
  room_type_id: null,
  last_cleaned_at: null,
  hotel_room_types: { name: 'Standard' },
};

it('loads the hotel rooms and reports a first-load failure', async () => {
  const mockRooms = jest.spyOn(deskDb, 'rooms').mockResolvedValue({ ok: true, value: [room] });
  const qc = makeQueryClient();
  const hook = await renderHook(() => useRooms(), { wrapper: deskWrapper(qc) });
  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });
  expect(mockRooms).toHaveBeenCalledWith(HOTEL);
  expect(hook.result.current.rooms).toEqual([room]);
  expect(hook.result.current.error).toBe(false);
  await hook.unmount();
  qc.clear();

  mockRooms.mockResolvedValue({ ok: false, error: { kind: 'timeout' } });
  const qc2 = makeQueryClient();
  const failed = await renderHook(() => useRooms(), { wrapper: deskWrapper(qc2) });
  await waitFor(() => {
    expect(failed.result.current.error).toBe(true);
  });
  expect(failed.result.current.rooms).toEqual([]);
  expect(failed.result.current.loading).toBe(false);
  await failed.unmount();
  qc2.clear();
});
