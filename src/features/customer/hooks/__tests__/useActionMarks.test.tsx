import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRefundRequested, useReviewedSet } from '@/features/customer/hooks/useActionMarks';
import type { memoryKv } from '@/shared/lib/kv';

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

let qc: QueryClient;
beforeEach(async () => {
  mockSessionUser = USER;
  qc = makeQueryClient();
  for (const k of Object.keys(mockKv.dump())) await mockKv.delete(k);
});
afterEach(() => {
  qc.clear();
});

it('reads what this device remembers for the user', async () => {
  await mockKv.set('bh.reviewed.u1', '["l1"]');
  const { result, unmount } = await renderHook(() => useReviewedSet(USER), {
    wrapper: wrapper(qc),
  });
  await waitFor(() => {
    expect(result.current.has('l1')).toBe(true);
  });
  expect(result.current.has('l2')).toBe(false);
  await unmount();
});

it('marks at once and on disk while the same user is signed in', async () => {
  const { result, unmount } = await renderHook(() => useRefundRequested(USER), {
    wrapper: wrapper(qc),
  });
  await act(async () => {
    await result.current.mark('b1');
  });
  await waitFor(() => {
    expect(result.current.has('b1')).toBe(true);
  });
  expect(mockKv.dump()['bh.refund-req.u1']).toBe('["b1"]');
  await unmount();
});

it('after sign-out (or another account) the mark stays in memory only', async () => {
  const { result, unmount } = await renderHook(() => useReviewedSet(USER), {
    wrapper: wrapper(qc),
  });
  mockSessionUser = 'u2';
  await act(async () => {
    await result.current.mark('l1');
  });
  mockSessionUser = null;
  await act(async () => {
    await result.current.mark('l2');
  });
  // The render can trail the cache by a tick: wait for both.
  await waitFor(() => {
    expect([result.current.has('l1'), result.current.has('l2')]).toEqual([true, true]);
  });
  expect(mockKv.dump()).toEqual({});
  await unmount();
});

it('marking before the first read lands keeps the ids already on disk', async () => {
  await mockKv.set('bh.reviewed.u1', '["l0"]');
  // The first read hangs, so mark() cancels it.
  const get = jest
    .spyOn(mockKv, 'get')
    .mockImplementationOnce(() => new Promise<string | null>(() => undefined));
  const { result, unmount } = await renderHook(() => useReviewedSet(USER), {
    wrapper: wrapper(qc),
  });
  await act(async () => {
    await result.current.mark('l1');
  });
  await waitFor(() => {
    expect([result.current.has('l0'), result.current.has('l1')]).toEqual([true, true]);
  });
  expect(mockKv.dump()['bh.reviewed.u1']).toBe('["l0","l1"]');
  get.mockRestore();
  await unmount();
});
