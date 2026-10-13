import { act, renderHook, waitFor } from '@testing-library/react-native';

import { customerDb } from '@/features/customer/api/customerDb';
import { useNotifications } from '@/features/customer/hooks/useNotifications';
import { useUnreadCount } from '@/features/customer/hooks/useUnreadCount';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, note, USER, wrapper } from './customerTestUtils';

let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/shared/supabase/client', () => ({
  supabase: { auth: { refreshSession: jest.fn(), updateUser: jest.fn() } },
}));
jest.mock('@/features/customer/api/customerDb', () => ({
  ...jest.requireActual<object>('@/features/customer/api/customerDb'),
  customerDb: {
    unreadCount: jest.fn(),
    notifications: jest.fn(),
    markRead: jest.fn(),
  },
}));

type Db = typeof customerDb;
let count: jest.SpiedFunction<Db['unreadCount']>;

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  count = jest.spyOn(customerDb, 'unreadCount').mockResolvedValue(ok(3));
  jest.spyOn(customerDb, 'notifications').mockResolvedValue(ok([note('a')]));
  jest.spyOn(customerDb, 'markRead').mockResolvedValue(ok(1));
});

it('gives the unread count', async () => {
  const qc = makeQueryClient();
  const hook = await renderHook(() => useUnreadCount(USER), { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(hook.result.current).toBe(3);
  });
  expect(count).toHaveBeenCalledWith(USER);
  await hook.unmount();
  qc.clear();
});

it('a failed count shows no badge', async () => {
  count.mockResolvedValue(err({ kind: 'network' }));
  const qc = makeQueryClient();
  const hook = await renderHook(() => useUnreadCount(USER), { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(count).toHaveBeenCalled();
  });
  expect(hook.result.current).toBe(0);
  await hook.unmount();
  qc.clear();
});

it('a notification write refreshes the count', async () => {
  const qc = makeQueryClient();
  const hook = await renderHook(
    () => ({ bell: useUnreadCount(USER), list: useNotifications(USER) }),
    { wrapper: wrapper(qc) },
  );
  await waitFor(() => {
    expect(hook.result.current.list.items).toHaveLength(1);
  });
  expect(count).toHaveBeenCalledTimes(1);
  count.mockResolvedValue(ok(2));
  const first = hook.result.current.list.items[0];
  if (first === undefined) throw new Error('no row');
  await act(() => {
    hook.result.current.list.open(first);
  });
  await waitFor(() => {
    expect(hook.result.current.bell).toBe(2);
  });
  expect(count).toHaveBeenCalledTimes(2);
  await hook.unmount();
  qc.clear();
});

describe('freshness', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('never polls; regaining focus refetches', async () => {
    const qc = makeQueryClient();
    const hook = await renderHook(() => useUnreadCount(USER), { wrapper: wrapper(qc) });
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(count).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(10 * 60_000);
    });
    expect(count).toHaveBeenCalledTimes(1);

    mockFocused = false;
    await hook.rerender(undefined);
    mockFocused = true;
    await hook.rerender(undefined);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(count).toHaveBeenCalledTimes(2);
    await hook.unmount();
    qc.clear();
  });
});
