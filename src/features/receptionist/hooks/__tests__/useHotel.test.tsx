import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { useHotel, type HotelState } from '@/features/receptionist/hooks/useHotel';
import type { StaffHotelRow } from '@/features/receptionist/schemas/desk';
import { plainKv } from '@/shared/platform/storage';

jest.mock('@/features/receptionist/api/deskDb', () => ({ deskDb: { staffHotels: jest.fn() } }));
jest.mock('@/shared/platform/storage', () => ({
  plainKv: { get: jest.fn(), set: jest.fn(), delete: jest.fn() },
}));

// Spies, not jest.mocked(obj.method): referencing a method unbound trips the lint rule.
let mockStaff: jest.SpiedFunction<typeof deskDb.staffHotels>;
let kv: {
  get: jest.SpiedFunction<typeof plainKv.get>;
  set: jest.SpiedFunction<typeof plainKv.set>;
  delete: jest.SpiedFunction<typeof plainKv.delete>;
};
const USER = 'u1';
const KEY = 'bh.desk.hotel.u1';

const row = (id: string, name: string, city: string | null = 'Ikeja'): StaffHotelRow => ({
  hotel_id: id,
  hotels: { id, name, city, state: 'Lagos' },
});
const hidden = (id: string): StaffHotelRow => ({ hotel_id: id, hotels: null });

beforeEach(() => {
  jest.clearAllMocks();
  mockStaff = jest.spyOn(deskDb, 'staffHotels');
  kv = {
    get: jest.spyOn(plainKv, 'get').mockResolvedValue(null),
    set: jest.spyOn(plainKv, 'set').mockResolvedValue(undefined),
    delete: jest.spyOn(plainKv, 'delete').mockResolvedValue(undefined),
  };
});

async function run(rows: StaffHotelRow[] | { kind: 'network' }) {
  if (Array.isArray(rows)) mockStaff.mockResolvedValue({ ok: true, value: rows });
  else mockStaff.mockResolvedValue({ ok: false, error: rows });
  // gcTime Infinity: no 5-minute GC timer after unmount to keep the Jest worker alive.
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useHotel(USER), { wrapper });
  await waitFor(() => {
    expect(hook.result.current.status).not.toBe('loading');
  });
  return {
    result: hook.result,
    qc,
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

function expectStatus<S extends HotelState['status']>(
  s: HotelState,
  status: S,
): Extract<HotelState, { status: S }> {
  expect(s.status).toBe(status);
  if (s.status !== status) throw new Error(`expected ${status}, got ${s.status}`);
  return s as Extract<HotelState, { status: S }>;
}

it('starts loading and reports none for a user with no staff rows', async () => {
  const { result, done } = await run([]);
  expect(result.current.status).toBe('none');
  expect(mockStaff).toHaveBeenCalledWith(USER);
  await done();
});

it('is ready at once with one usable hotel, with its place', async () => {
  const { result, done } = await run([row('h1', 'Eko Suites')]);
  const s = expectStatus(result.current, 'ready');
  expect(s.hotel).toEqual({ id: 'h1', name: 'Eko Suites', place: 'Ikeja, Lagos' });
  expect(s.hotels).toHaveLength(1);
  await done();
});

it('a hotel without a city shows the state alone, and no place when both are missing', async () => {
  const { result, done } = await run([
    row('h1', 'A', null),
    { hotel_id: 'h2', hotels: { id: 'h2', name: 'B', city: null, state: null } },
  ]);
  const s = expectStatus(result.current, 'pick');
  expect(s.hotels.map((h) => h.place)).toEqual(['Lagos', '']);
  await done();
});

it('is unavailable when every staff row points at a hidden hotel', async () => {
  const { result, done } = await run([hidden('h1'), hidden('h2')]);
  expect(result.current.status).toBe('unavailable');
  await done();
});

it('drops hidden hotels and is ready when one usable hotel remains', async () => {
  const { result, done } = await run([hidden('h1'), row('h2', 'Eko Suites')]);
  const s = expectStatus(result.current, 'ready');
  expect(s.hotel.id).toBe('h2');
  await done();
});

it('offers a picker for two hotels, remembers the choice, and change() forgets it', async () => {
  const { result, done } = await run([row('h1', 'A'), row('h2', 'B')]);
  const pick = expectStatus(result.current, 'pick');
  expect(pick.hotels.map((h) => h.id)).toEqual(['h1', 'h2']);
  await act(() => {
    pick.choose('h2');
  });
  const ready = expectStatus(result.current, 'ready');
  expect(ready.hotel.id).toBe('h2');
  expect(ready.hotels).toHaveLength(2);
  expect(kv.set).toHaveBeenCalledWith(KEY, 'h2');
  await act(() => {
    ready.change();
  });
  expect(result.current.status).toBe('pick');
  expect(kv.delete).toHaveBeenCalledWith(KEY);
  await done();
});

it('uses a remembered choice for two hotels without asking', async () => {
  kv.get.mockResolvedValue('h2');
  const { result, done } = await run([row('h1', 'A'), row('h2', 'B')]);
  const s = expectStatus(result.current, 'ready');
  expect(s.hotel.id).toBe('h2');
  expect(kv.get).toHaveBeenCalledWith(KEY);
  await done();
});

it('ignores a remembered id that no longer matches a hotel', async () => {
  kv.get.mockResolvedValue('gone');
  const { result, done } = await run([row('h1', 'A'), row('h2', 'B')]);
  expect(result.current.status).toBe('pick');
  await done();
});

it('keeps working when storage throws', async () => {
  kv.get.mockRejectedValue(new Error('disk'));
  kv.set.mockRejectedValue(new Error('disk'));
  const { result, done } = await run([row('h1', 'A'), row('h2', 'B')]);
  const pick = expectStatus(result.current, 'pick');
  await act(() => {
    pick.choose('h1');
  });
  expect(expectStatus(result.current, 'ready').hotel.id).toBe('h1');
  await done();
});

it('reports an error with a retry that refetches', async () => {
  const { result, done } = await run({ kind: 'network' });
  const s = expectStatus(result.current, 'error');
  mockStaff.mockResolvedValue({ ok: true, value: [row('h1', 'A')] });
  await act(() => {
    s.retry();
  });
  await waitFor(() => {
    expect(result.current.status).toBe('ready');
  });
  expect(mockStaff).toHaveBeenCalledTimes(2);
  await done();
});

it('keeps serving the hotel when a background refresh fails', async () => {
  const { result, qc, done } = await run([row('h1', 'Eko Suites')]);
  expect(result.current.status).toBe('ready');
  mockStaff.mockResolvedValue({ ok: false, error: { kind: 'unavailable', status: 503 } });
  await act(() => qc.refetchQueries({ queryKey: ['desk', 'staff', USER] }));
  expect(mockStaff).toHaveBeenCalledTimes(2);
  expect(expectStatus(result.current, 'ready').hotel.id).toBe('h1');
  await done();
});
