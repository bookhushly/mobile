import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { savedDb, type SavedInput, type SavedItem } from '@/features/customer/api/savedDb';
import { savedOutcome } from '@/features/customer/hooks/sessionWrite';
import { useSaved } from '@/features/customer/hooks/useSaved';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, NOON, USER, wrapper } from './customerTestUtils';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
let mockNow = 0;
jest.mock('@/shared/supabase/client', () => ({ supabase: { auth: {} } }));
jest.mock('@/features/customer/api/savedDb', () => ({
  savedDb: { list: jest.fn(), save: jest.fn(), unsave: jest.fn(), isSaved: jest.fn() },
}));

type Db = typeof savedDb;
let list: jest.SpiedFunction<Db['list']>;
let save: jest.SpiedFunction<Db['save']>;
let unsave: jest.SpiedFunction<Db['unsave']>;

const HOTEL: SavedInput = {
  listingId: 'h1',
  kind: 'hotel',
  title: 'Harbour Suites',
  image: null,
  location: 'Ikeja, Lagos',
};
const EVENT: SavedInput = {
  listingId: 'e1',
  kind: 'event',
  title: 'Afrobeats night',
  image: null,
  location: 'Eko Hotel',
};
const row = (s: SavedInput, createdAt: string): SavedItem => ({
  ...s,
  id: `id-${s.listingId}`,
  createdAt,
});

function deferred<T>() {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let qc: QueryClient;
beforeEach(() => {
  jest.clearAllMocks();
  mockNow = NOON;
  qc = makeQueryClient();
  list = jest
    .spyOn(savedDb, 'list')
    .mockResolvedValue(ok([row(EVENT, '2026-10-12T10:00:00.000Z')]));
  save = jest.spyOn(savedDb, 'save').mockResolvedValue(ok(undefined));
  unsave = jest.spyOn(savedDb, 'unsave').mockResolvedValue(ok(undefined));
});
afterEach(() => {
  qc.clear();
});

async function run() {
  const hook = await renderHook(() => useSaved(USER), { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(hook.result.current.ready).toBe(true);
  });
  return hook;
}

describe('savedOutcome', () => {
  it.each<[Parameters<typeof savedOutcome>[0], string]>([
    [ok(undefined), 'ok'],
    [err({ kind: 'staleSession' }), 'stale'],
    [err({ kind: 'auth' }), 'stale'],
    [err({ kind: 'forbidden', code: '42501' }), 'stale'],
    [err({ kind: 'network' }), 'transient'],
    [err({ kind: 'rateLimited' }), 'transient'],
    [err({ kind: 'unknown' }), 'transient'],
  ])('%p → %s', (r, want) => {
    expect(savedOutcome(r)).toBe(want);
  });
});

describe('useSaved', () => {
  it('lists the user’s saved items and answers isSaved', async () => {
    const { result, unmount } = await run();
    expect(list).toHaveBeenCalledWith(USER);
    expect(result.current.isSaved('event', 'e1')).toBe(true);
    expect(result.current.isSaved('hotel', 'e1')).toBe(false);
    expect(result.current.isSaved('hotel', 'h1')).toBe(false);
    await unmount();
  });

  it('saves optimistically, writes through savedDb, then refetches the list', async () => {
    const write = deferred<Awaited<ReturnType<Db['save']>>>();
    save.mockReturnValue(write.promise);
    const { result, unmount } = await run();
    let done: Promise<string> = Promise.resolve('');
    await act(() => {
      done = result.current.toggle(HOTEL);
    });
    expect(result.current.isSaved('hotel', 'h1')).toBe(true);
    expect(result.current.items[0]?.listingId).toBe('h1');
    expect(save).toHaveBeenCalledWith(USER, HOTEL);
    list.mockResolvedValue(
      ok([row(HOTEL, '2026-10-13T11:00:00.000Z'), row(EVENT, '2026-10-12T10:00:00.000Z')]),
    );
    await act(async () => {
      write.resolve(ok(undefined));
      expect(await done).toBe('ok');
    });
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(2);
    });
    expect(result.current.writeError).toBeNull();
    await unmount();
  });

  it('a failed save rolls back just that heart; a stale session is "stale", never a refusal', async () => {
    save.mockResolvedValue(err({ kind: 'forbidden', code: '42501' }));
    const { result, unmount } = await run();
    await act(async () => {
      expect(await result.current.toggle(HOTEL)).toBe('stale');
    });
    expect(result.current.isSaved('hotel', 'h1')).toBe(false);
    expect(result.current.isSaved('event', 'e1')).toBe(true);
    expect(result.current.writeError).toBe('stale');
    await act(() => {
      result.current.clearWriteError();
    });
    expect(result.current.writeError).toBeNull();
    await unmount();
  });

  it('a failed unsave puts the item back in place and is transient on a network error', async () => {
    unsave.mockResolvedValue(err({ kind: 'network' }));
    const { result, unmount } = await run();
    await act(async () => {
      expect(await result.current.toggle(EVENT)).toBe('transient');
    });
    expect(result.current.isSaved('event', 'e1')).toBe(true);
    expect(result.current.items[0]?.id).toBe('id-e1');
    expect(result.current.lastRemoved).toBeNull();
    expect(result.current.writeError).toBe('transient');
    await unmount();
  });

  it('unsave offers Undo, which saves it again only after the unsave has finished', async () => {
    const gone = deferred<Awaited<ReturnType<Db['unsave']>>>();
    unsave.mockReturnValue(gone.promise);
    const { result, unmount } = await run();
    let first: Promise<string> = Promise.resolve('');
    await act(() => {
      first = result.current.toggle(EVENT);
    });
    expect(result.current.isSaved('event', 'e1')).toBe(false);
    expect(result.current.lastRemoved).toEqual(EVENT);
    let undone: Promise<string | null> = Promise.resolve(null);
    await act(() => {
      undone = result.current.undo();
    });
    expect(result.current.isSaved('event', 'e1')).toBe(true);
    expect(result.current.lastRemoved).toBeNull();
    // The save waits for the unsave: the server ends saved, whatever order the replies take.
    expect(save).not.toHaveBeenCalled();
    await act(async () => {
      gone.resolve(ok(undefined));
      expect(await first).toBe('ok');
      expect(await undone).toBe('ok');
    });
    expect(save).toHaveBeenCalledWith(USER, EVENT);
    expect(unsave.mock.invocationCallOrder[0]).toBeLessThan(save.mock.invocationCallOrder[0] ?? 0);
    await unmount();
  });

  it('quick taps on one heart write in tap order, and the list refetches once at the end', async () => {
    const first = deferred<Awaited<ReturnType<Db['save']>>>();
    save.mockReturnValueOnce(first.promise);
    const { result, unmount } = await run();
    const outcomes: Promise<string>[] = [];
    await act(() => {
      outcomes.push(result.current.toggle(HOTEL));
    });
    await act(() => {
      outcomes.push(result.current.toggle(HOTEL));
    });
    expect(result.current.isSaved('hotel', 'h1')).toBe(false);
    expect(unsave).not.toHaveBeenCalled();
    await act(async () => {
      first.resolve(ok(undefined));
      await Promise.all(outcomes);
    });
    expect(unsave).toHaveBeenCalledWith(USER, HOTEL);
    await waitFor(() => {
      expect(list).toHaveBeenCalledTimes(2);
    });
    await unmount();
  });

  it('dismissUndo clears the Undo offer', async () => {
    const { result, unmount } = await run();
    await act(async () => {
      await result.current.toggle(EVENT);
    });
    expect(result.current.lastRemoved).toEqual(EVENT);
    await act(() => {
      result.current.dismissUndo();
    });
    expect(result.current.lastRemoved).toBeNull();
    expect(await result.current.undo()).toBeNull();
    await unmount();
  });
});

describe('useSaved across screens', () => {
  it('two instances (e.g. Explore and detail) share one write queue and one settle-then-refetch', async () => {
    const first = deferred<Awaited<ReturnType<Db['save']>>>();
    save.mockReturnValueOnce(first.promise);
    const a = await run();
    const b = await run();
    const outcomes: Promise<string>[] = [];
    await act(() => {
      outcomes.push(a.result.current.toggle(HOTEL));
    });
    // The other screen sees the optimistic heart and unsaves it before the save has replied.
    await waitFor(() => {
      expect(b.result.current.isSaved('hotel', 'h1')).toBe(true);
    });
    await act(() => {
      outcomes.push(b.result.current.toggle(HOTEL));
    });
    await waitFor(() => {
      expect(a.result.current.isSaved('hotel', 'h1')).toBe(false);
    });
    // Tap order across instances: the unsave waits for the save.
    expect(unsave).not.toHaveBeenCalled();
    const listCalls = list.mock.calls.length;
    await act(async () => {
      first.resolve(ok(undefined));
      await Promise.all(outcomes);
    });
    expect(unsave).toHaveBeenCalledWith(USER, HOTEL);
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(unsave.mock.invocationCallOrder[0] ?? 0);
    // One refetch once both settled, not one per instance write mid-flight.
    await waitFor(() => {
      expect(list.mock.calls.length).toBe(listCalls + 1);
    });
    await a.unmount();
    await b.unmount();
  });

  it('a settle on one screen never refetches over a write still in flight from another', async () => {
    const slow = deferred<Awaited<ReturnType<Db['unsave']>>>();
    unsave.mockReturnValueOnce(slow.promise);
    const a = await run();
    const b = await run();
    const listCalls = list.mock.calls.length;
    let slowDone: Promise<string> = Promise.resolve('');
    await act(() => {
      slowDone = b.result.current.toggle(EVENT);
    });
    await act(async () => {
      expect(await a.result.current.toggle(HOTEL)).toBe('ok');
    });
    expect(list.mock.calls.length).toBe(listCalls);
    await waitFor(() => {
      expect(b.result.current.isSaved('event', 'e1')).toBe(false);
    });
    await act(async () => {
      slow.resolve(ok(undefined));
      await slowDone;
    });
    await waitFor(() => {
      expect(list.mock.calls.length).toBe(listCalls + 1);
    });
    await a.unmount();
    await b.unmount();
  });
});

describe('Review Focus 4: saved after a lost response', () => {
  it('a save whose reply is lost rolls back, and tapping again saves (never unsaves)', async () => {
    save.mockResolvedValueOnce(err({ kind: 'network' }));
    const { result, unmount } = await run();
    await act(async () => {
      expect(await result.current.toggle(HOTEL)).toBe('transient');
    });
    expect(result.current.isSaved('hotel', 'h1')).toBe(false);
    await act(async () => {
      expect(await result.current.toggle(HOTEL)).toBe('ok');
    });
    expect(save).toHaveBeenCalledTimes(2);
    expect(unsave).not.toHaveBeenCalled();
    await unmount();
  });
});

it('no user: no list query', async () => {
  const { result, unmount } = await renderHook(() => useSaved(''), { wrapper: wrapper(qc) });
  expect(list).not.toHaveBeenCalled();
  expect(result.current.ready).toBe(false);
  await unmount();
});
