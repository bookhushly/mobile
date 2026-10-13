import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { customerDb } from '@/features/customer/api/customerDb';
import { explorePlaceKey, useExplorePlace } from '@/features/customer/hooks/useExplorePlace';
import { useRecentSearches } from '@/features/customer/hooks/useRecentSearches';
import { recentKey, type RecentSearch } from '@/features/customer/offline/recentSearches';
import type { memoryKv } from '@/shared/lib/kv';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, USER, wrapper } from './customerTestUtils';

jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));
const mockKv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;
let mockSessionUser: string | null = 'u1';
jest.mock('@/shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: mockSessionUser === null ? null : { user: { id: mockSessionUser } } },
        }),
    },
  },
}));
jest.mock('@/features/customer/api/customerDb', () => ({ customerDb: { profile: jest.fn() } }));

let profile: jest.SpiedFunction<typeof customerDb.profile>;
const LEKKI: RecentSearch = { label: 'Lekki', category: 'hotels', q: 'Lekki' };

let qc: QueryClient;
beforeEach(async () => {
  jest.clearAllMocks();
  mockSessionUser = USER;
  qc = makeQueryClient();
  for (const k of Object.keys(mockKv.dump())) await mockKv.delete(k);
  profile = jest
    .spyOn(customerDb, 'profile')
    .mockResolvedValue(
      ok({ id: USER, email: 'a@b.c', name: 'Ada', phone: null, state: 'FCT', address: null }),
    );
});
afterEach(() => {
  qc.clear();
});

describe('useRecentSearches', () => {
  it('adds and removes for the signed-in user', async () => {
    const { result, unmount } = await renderHook(() => useRecentSearches(USER), {
      wrapper: wrapper(qc),
    });
    await act(async () => {
      await result.current.add(LEKKI);
    });
    await waitFor(() => {
      expect(result.current.items).toEqual([LEKKI]);
    });
    await act(async () => {
      await result.current.remove(LEKKI);
    });
    await waitFor(() => {
      expect(result.current.items).toEqual([]);
    });
    await unmount();
  });

  it('an add after sign-out (or for another account) writes nothing', async () => {
    const { result, unmount } = await renderHook(() => useRecentSearches(USER), {
      wrapper: wrapper(qc),
    });
    mockSessionUser = null;
    await act(async () => {
      await result.current.add(LEKKI);
    });
    mockSessionUser = 'u2';
    await act(async () => {
      await result.current.add(LEKKI);
    });
    expect(mockKv.dump()[recentKey(USER)]).toBeUndefined();
    expect(result.current.items).toEqual([]);
    await unmount();
  });
});

describe('useExplorePlace', () => {
  it('defaults to the profile’s state as a place', async () => {
    const { result, unmount } = await renderHook(() => useExplorePlace(USER), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.place).toEqual({ label: 'Abuja', state: 'FCT' });
    });
    await unmount();
  });

  it('falls back to Lagos when the profile has no state or can’t load', async () => {
    profile.mockResolvedValue(err({ kind: 'validation' }));
    const { result, unmount } = await renderHook(() => useExplorePlace(USER), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.place).toEqual({ label: 'Lagos', state: 'Lagos' });
    });
    await unmount();
  });

  it('the default, once chosen, doesn’t flip when the profile loads later', async () => {
    profile.mockResolvedValueOnce(err({ kind: 'validation' }));
    const { result, unmount } = await renderHook(() => useExplorePlace(USER), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.place).toEqual({ label: 'Lagos', state: 'Lagos' });
    });
    await act(async () => {
      await qc.refetchQueries({ queryKey: ['customer', USER, 'profile'] });
    });
    expect(profile).toHaveBeenCalledTimes(2);
    expect(result.current.place).toEqual({ label: 'Lagos', state: 'Lagos' });
    await unmount();
  });

  it('a remembered place wins, and a new choice is remembered per user', async () => {
    await mockKv.set(explorePlaceKey(USER), JSON.stringify({ label: 'Ibadan', city: 'Ibadan' }));
    const { result, unmount } = await renderHook(() => useExplorePlace(USER), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.place).toEqual({ label: 'Ibadan', city: 'Ibadan' });
    });
    await act(() => {
      result.current.setPlace({ label: 'Kano', state: 'Kano' });
    });
    await waitFor(() => {
      expect(result.current.place).toEqual({ label: 'Kano', state: 'Kano' });
    });
    await waitFor(() => {
      expect(mockKv.dump()['bh.explore.place.u1']).toBe('{"label":"Kano","state":"Kano"}');
    });
    await unmount();
  });

  it('a stored value the app doesn’t offer is ignored', async () => {
    await mockKv.set(explorePlaceKey(USER), '{"label":"x","state":"Mars"}');
    const { result, unmount } = await renderHook(() => useExplorePlace(USER), {
      wrapper: wrapper(qc),
    });
    await waitFor(() => {
      expect(result.current.place).toEqual({ label: 'Abuja', state: 'FCT' });
    });
    await unmount();
  });
});
