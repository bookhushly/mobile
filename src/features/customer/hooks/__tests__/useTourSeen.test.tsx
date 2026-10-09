import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useTourSeen } from '@/features/customer/hooks/useTourSeen';
import { CUSTOMER_TOUR_ENABLED } from '@/shared/config/features';

// In-memory SecureStore; `get` can be swapped per test. The factory must not touch module-scope
// values eagerly (hoisting), so the object is reached lazily and is `mock`-prefixed.
const mockKv = {
  map: new Map<string, string>(),
  get: (k: string): Promise<string | null> => Promise.resolve(mockKv.map.get(k) ?? null),
};
jest.mock('@/shared/platform/secureStore', () => ({
  secureKv: {
    get: (k: string) => mockKv.get(k),
    set: (k: string, v: string) => {
      mockKv.map.set(k, v);
      return Promise.resolve();
    },
    delete: (k: string) => {
      mockKv.map.delete(k);
      return Promise.resolve();
    },
  },
}));

beforeEach(() => {
  mockKv.map.clear();
  mockKv.get = (k) => Promise.resolve(mockKv.map.get(k) ?? null);
});

it('ships switched off', () => {
  expect(CUSTOMER_TOUR_ENABLED).toBe(false);
});

it('is null while loading, then false for a new user', async () => {
  let answer: (v: string | null) => void = () => undefined;
  mockKv.get = () =>
    new Promise<string | null>((resolve) => {
      answer = resolve;
    });
  const { result } = await renderHook(() => useTourSeen('u1'));
  expect(result.current.seen).toBeNull();
  await act(() => {
    answer(null);
  });
  await waitFor(() => {
    expect(result.current.seen).toBe(false);
  });
});

it('markSeen stores per user and flips to true', async () => {
  const { result } = await renderHook(() => useTourSeen('u1'));
  await waitFor(() => {
    expect(result.current.seen).toBe(false);
  });
  await act(() => {
    result.current.markSeen();
  });
  expect(result.current.seen).toBe(true);
  await waitFor(() => {
    expect(mockKv.map.get('bh.tour.u1')).toBe('1');
  });
  const other = await renderHook(() => useTourSeen('u2'));
  await waitFor(() => {
    expect(other.result.current.seen).toBe(false);
  });
});

it('a stored marker reads back as seen', async () => {
  mockKv.map.set('bh.tour.u1', '1');
  const { result } = await renderHook(() => useTourSeen('u1'));
  await waitFor(() => {
    expect(result.current.seen).toBe(true);
  });
});

it('a failing read never blocks the app: treated as seen', async () => {
  mockKv.get = () => Promise.reject(new Error('keychain locked'));
  const { result } = await renderHook(() => useTourSeen('u1'));
  await waitFor(() => {
    expect(result.current.seen).toBe(true);
  });
});

it('no user: stays null and never reads the keychain', async () => {
  const get = jest.fn(mockKv.get);
  mockKv.get = get;
  const { result } = await renderHook(() => useTourSeen(null));
  expect(result.current.seen).toBeNull();
  await act(() => {
    result.current.markSeen();
  });
  expect(get).not.toHaveBeenCalled();
  expect(mockKv.map.size).toBe(0);
});
