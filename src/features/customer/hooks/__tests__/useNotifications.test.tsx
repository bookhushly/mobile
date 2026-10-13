import { onlineManager } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { customerDb } from '@/features/customer/api/customerDb';
import { NOTIFICATIONS_POLL_MS } from '@/features/customer/hooks/customerKeys';
import { useNotifications } from '@/features/customer/hooks/useNotifications';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';
import { supabase } from '@/shared/supabase/client';

import { makeQueryClient, note, USER, wrapper } from './customerTestUtils';

let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/shared/supabase/client', () => ({
  supabase: { auth: { refreshSession: jest.fn(), updateUser: jest.fn() } },
}));
jest.mock('@/features/customer/api/customerDb', () => ({
  ...jest.requireActual<object>('@/features/customer/api/customerDb'),
  customerDb: {
    notifications: jest.fn(),
    markRead: jest.fn(),
    markUnread: jest.fn(),
    markAllRead: jest.fn(),
    remove: jest.fn(),
  },
}));

// Spies, not jest.mocked(obj.method): referencing a method unbound trips the lint rule.
type Db = typeof customerDb;
let db: {
  notifications: jest.SpiedFunction<Db['notifications']>;
  markRead: jest.SpiedFunction<Db['markRead']>;
  markUnread: jest.SpiedFunction<Db['markUnread']>;
  markAllRead: jest.SpiedFunction<Db['markAllRead']>;
  remove: jest.SpiedFunction<Db['remove']>;
};
let refresh: jest.SpiedFunction<typeof supabase.auth.refreshSession>;
type Written = Result<number, ApiError>;

function deferred() {
  let resolve: (v: Written) => void = () => undefined;
  const promise = new Promise<Written>((r) => (resolve = r));
  return { promise, resolve };
}

const ROWS = [note('a'), note('bb', { read: true }), note('ccc')];

beforeEach(() => {
  jest.clearAllMocks();
  mockFocused = true;
  db = {
    notifications: jest.spyOn(customerDb, 'notifications').mockResolvedValue(ok(ROWS)),
    markRead: jest.spyOn(customerDb, 'markRead').mockResolvedValue(ok(1)),
    markUnread: jest.spyOn(customerDb, 'markUnread').mockResolvedValue(ok(2)),
    markAllRead: jest.spyOn(customerDb, 'markAllRead').mockResolvedValue(ok(2)),
    remove: jest.spyOn(customerDb, 'remove').mockResolvedValue(ok(1)),
  };
  refresh = jest
    .spyOn(supabase.auth, 'refreshSession')
    .mockResolvedValue({ data: { session: {} }, error: null } as never);
});

async function run() {
  const qc = makeQueryClient();
  const hook = await renderHook(() => useNotifications(USER), { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(hook.result.current.loading).toBe(false);
  });
  return {
    result: hook.result,
    rerender: () => hook.rerender(undefined),
    done: async () => {
      await hook.unmount();
      qc.clear();
    },
  };
}

const readMap = (items: { id: string; read: boolean }[]) =>
  Object.fromEntries(items.map((n) => [n.id, n.read]));

it('lists notifications with the unread count', async () => {
  const { result, done } = await run();
  expect(db.notifications).toHaveBeenCalledWith(USER);
  expect(result.current.items.map((n) => n.id)).toEqual(['a', 'bb', 'ccc']);
  expect(result.current.unread).toBe(2);
  expect(result.current.error).toBe(false);
  await done();
});

it('reports an error when the first load fails', async () => {
  db.notifications.mockResolvedValue(err({ kind: 'network' }));
  const { result, done } = await run();
  expect(result.current.error).toBe(true);
  expect(result.current.items).toEqual([]);
  await done();
});

it('offline, says it could not load instead of spinning', async () => {
  onlineManager.setOnline(false);
  try {
    const qc = makeQueryClient();
    const hook = await renderHook(() => useNotifications(USER), { wrapper: wrapper(qc) });
    await waitFor(() => {
      expect(hook.result.current.error).toBe(true);
    });
    expect(hook.result.current.loading).toBe(false);
    expect(db.notifications).not.toHaveBeenCalled();
    await hook.unmount();
    qc.clear();
  } finally {
    onlineManager.setOnline(true);
  }
});

it('opening an unread one marks it read at once; a read one writes nothing', async () => {
  const d = deferred();
  db.markRead.mockReturnValueOnce(d.promise);
  const { result, done } = await run();
  await act(() => {
    result.current.open(ROWS[0] ?? note('x'));
  });
  expect(result.current.unread).toBe(1);
  expect(db.markRead).toHaveBeenCalledWith(USER, ['a']);
  await act(async () => {
    d.resolve(ok(1));
    await d.promise;
  });
  expect(result.current.writeError).toBeNull();

  await act(() => {
    result.current.open(ROWS[1] ?? note('x'));
  });
  expect(db.markRead).toHaveBeenCalledTimes(1);
  await done();
});

it('marking one read: zero rows → refresh → retry → stale → rolled back', async () => {
  const first = deferred();
  db.markRead.mockReturnValueOnce(first.promise).mockResolvedValueOnce(ok(0));
  const { result, done } = await run();

  // The refetch after the write fails: only the rollback can put the rows back.
  db.notifications.mockResolvedValue(err({ kind: 'network' }));
  await act(() => {
    result.current.open(ROWS[0] ?? note('x'));
  });
  // Optimistic.
  expect(result.current.unread).toBe(1);

  await act(async () => {
    first.resolve(ok(0));
    await first.promise;
  });
  await waitFor(() => {
    expect(result.current.writeError).toBe('stale');
  });
  expect(db.markRead).toHaveBeenCalledTimes(2);
  expect(refresh).toHaveBeenCalledTimes(1);
  expect(readMap(result.current.items)).toEqual({ a: false, bb: true, ccc: false });
  expect(result.current.unread).toBe(2);

  await act(() => {
    result.current.clearWriteError();
  });
  expect(result.current.writeError).toBeNull();
  await done();
});

it('a failed session refresh is stale without a retry', async () => {
  db.markRead.mockResolvedValue(ok(0));
  refresh.mockRejectedValue(new Error('offline'));
  const { result, done } = await run();
  db.notifications.mockResolvedValue(err({ kind: 'network' }));
  await act(() => {
    result.current.open(ROWS[2] ?? note('x'));
  });
  await waitFor(() => {
    expect(result.current.writeError).toBe('stale');
  });
  expect(db.markRead).toHaveBeenCalledTimes(1);
  expect(result.current.unread).toBe(2);
  await done();
});

it('mark all read touching 0 rows (read on another device) is fine, not stale', async () => {
  db.markAllRead.mockResolvedValue(ok(0));
  const { result, done } = await run();
  db.notifications.mockResolvedValue(ok(ROWS.map((n) => ({ ...n, read: true }))));
  await act(() => {
    result.current.markAllRead();
  });
  expect(result.current.unread).toBe(0);
  await waitFor(() => {
    expect(db.notifications).toHaveBeenCalledTimes(2);
  });
  expect(refresh).not.toHaveBeenCalled();
  expect(db.markAllRead).toHaveBeenCalledTimes(1);
  expect(result.current.writeError).toBeNull();
  expect(result.current.unread).toBe(0);
  await done();
});

it('a transient mark-all failure rolls back', async () => {
  db.markAllRead.mockResolvedValue(err({ kind: 'timeout' }));
  const { result, done } = await run();
  db.notifications.mockResolvedValue(err({ kind: 'network' }));
  await act(() => {
    result.current.markAllRead();
  });
  await waitFor(() => {
    expect(result.current.writeError).toBe('transient');
  });
  expect(result.current.unread).toBe(2);
  await done();
});

it('undo waits for the mark-all write, then marks the same ones unread', async () => {
  const d = deferred();
  db.markAllRead.mockReturnValueOnce(d.promise);
  const { result, done } = await run();
  await act(() => {
    result.current.markAllRead();
  });
  await act(() => {
    result.current.undoMarkAll();
  });
  // Still in flight: unread-marking now could commit first and leave the server all read.
  expect(db.markUnread).not.toHaveBeenCalled();
  await act(async () => {
    d.resolve(ok(2));
    await d.promise;
  });
  await waitFor(() => {
    expect(db.markUnread).toHaveBeenCalledWith(USER, ['a', 'ccc']);
  });
  // A second undo has nothing to put back.
  await act(() => {
    result.current.undoMarkAll();
  });
  expect(db.markUnread).toHaveBeenCalledTimes(1);
  await done();
});

it('undo after a failed mark-all writes nothing', async () => {
  db.markAllRead.mockResolvedValue(err({ kind: 'network' }));
  const { result, done } = await run();
  await act(() => {
    result.current.markAllRead();
  });
  await act(() => {
    result.current.undoMarkAll();
  });
  await waitFor(() => {
    expect(result.current.writeError).toBe('transient');
  });
  expect(db.markUnread).not.toHaveBeenCalled();
  await done();
});

it('deleting one already deleted elsewhere (0 rows) is done', async () => {
  db.remove.mockResolvedValue(ok(0));
  const { result, done } = await run();
  db.notifications.mockResolvedValue(ok(ROWS.filter((n) => n.id !== 'bb')));
  await act(() => {
    result.current.remove('bb');
  });
  await waitFor(() => {
    expect(db.notifications).toHaveBeenCalledTimes(2);
  });
  expect(refresh).not.toHaveBeenCalled();
  expect(result.current.writeError).toBeNull();
  expect(result.current.items.map((n) => n.id)).toEqual(['a', 'ccc']);
  await done();
});

it('a transient delete failure puts the row back in place', async () => {
  const d = deferred();
  db.remove.mockReturnValueOnce(d.promise);
  const { result, done } = await run();
  db.notifications.mockResolvedValue(err({ kind: 'network' }));
  await act(() => {
    result.current.remove('bb');
  });
  expect(result.current.items.map((n) => n.id)).toEqual(['a', 'ccc']);
  expect(db.remove).toHaveBeenCalledWith(USER, 'bb');
  await act(async () => {
    d.resolve(err({ kind: 'unavailable', status: 503 }));
    await d.promise;
  });
  await waitFor(() => {
    expect(result.current.writeError).toBe('transient');
  });
  expect(result.current.items.map((n) => n.id)).toEqual(['a', 'bb', 'ccc']);
  expect(refresh).not.toHaveBeenCalled();
  await done();
});

it('marks one read item unread', async () => {
  const d = deferred();
  db.markUnread.mockReturnValueOnce(d.promise);
  const { result, done } = await run();
  await act(() => {
    result.current.markUnread('bb');
  });
  expect(db.markUnread).toHaveBeenCalledWith(USER, ['bb']);
  expect(result.current.unread).toBe(3);
  await act(async () => {
    d.resolve(ok(1));
    await d.promise;
  });
  await done();
});

describe('polling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('refetches every 60 s while focused, and not when off screen', async () => {
    const { rerender, done } = await run();
    expect(db.notifications).toHaveBeenCalledTimes(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_MS);
    });
    expect(db.notifications).toHaveBeenCalledTimes(2);

    mockFocused = false;
    await rerender();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(NOTIFICATIONS_POLL_MS * 3);
    });
    expect(db.notifications).toHaveBeenCalledTimes(2);

    // Regaining focus with stale data refetches at once.
    mockFocused = true;
    await rerender();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(db.notifications).toHaveBeenCalledTimes(3);
    await done();
  });
});
