import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useRef, useState } from 'react';

import {
  savedDb,
  type SavedInput,
  type SavedItem,
  type SavedKey,
  type SavedKind,
} from '@/features/customer/api/savedDb';
import { CustomerLoadError, customerKeys } from '@/features/customer/hooks/customerKeys';
import { loadFailed } from '@/features/customer/hooks/loadState';
import {
  savedOutcome,
  type WriteError,
  type WriteOutcome,
} from '@/features/customer/hooks/sessionWrite';
import { clock } from '@/shared/api/instance';

const keyOf = (k: SavedKey) => `${k.kind}:${k.listingId}`;
const same = (a: SavedKey, b: SavedKey) => a.kind === b.kind && a.listingId === b.listingId;
const input = (s: SavedInput): SavedInput => ({
  listingId: s.listingId,
  kind: s.kind,
  title: s.title,
  image: s.image,
  location: s.location,
});
const newestFirst = (a: SavedItem, b: SavedItem) =>
  a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;

export type Saved = {
  items: SavedItem[];
  /** The list has loaded: until then `isSaved` doesn't know, so hearts wait. */
  ready: boolean;
  loading: boolean;
  /** Nothing to show: the load failed, or it is paused offline. */
  error: boolean;
  refetch: () => Promise<unknown>;
  isSaved: (kind: SavedKind, listingId: string) => boolean;
  /** Saves or unsaves (whichever the heart shows now), optimistically; undone on failure. */
  toggle: (item: SavedInput) => Promise<WriteOutcome>;
  /** The last unsaved item, for the Undo banner. */
  lastRemoved: SavedInput | null;
  /** Saves `lastRemoved` again, after its unsave has finished. */
  undo: () => Promise<WriteOutcome | null>;
  dismissUndo: () => void;
  /** 'stale' → the neutral "Sign in again" banner; 'transient' → "Check your connection". */
  writeError: WriteError | null;
  clearWriteError: () => void;
};

// Spec D9: saved_listings under RLS, keyed by user. Writes for one listing run one at a time in
// tap order (a quick save → unsave can never land the other way round); the list refetches once
// every write has settled, so a refetch can't overwrite a heart that is still being written.
export function useSaved(userId: string): Saved {
  const qc = useQueryClient();
  const k = customerKeys.saved(userId);
  const q = useQuery({
    queryKey: k,
    queryFn: async () => {
      const r = await savedDb.list(userId);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
  });
  const [lastRemoved, setLastRemoved] = useState<SavedInput | null>(null);
  const [writeError, setWriteError] = useState<WriteError | null>(null);
  const chains = useRef(new Map<string, Promise<unknown>>());
  const pending = useRef(0);

  const items = useMemo(() => q.data ?? [], [q.data]);
  const savedKeys = useMemo(() => new Set(items.map(keyOf)), [items]);
  const isSaved = useCallback(
    (kind: SavedKind, listingId: string) => savedKeys.has(keyOf({ kind, listingId })),
    [savedKeys],
  );

  const write = useCallback(
    (item: SavedInput, want: boolean): Promise<WriteOutcome> => {
      const key = customerKeys.saved(userId);
      const id = keyOf(item);
      const snapshot = input(item);
      let removed: SavedItem | undefined;
      void qc.cancelQueries({ queryKey: key });
      qc.setQueryData<SavedItem[]>(key, (rows) => {
        if (rows === undefined) return rows;
        if (want)
          return rows.some((r) => same(r, item))
            ? rows
            : [
                {
                  ...snapshot,
                  id: `pending:${id}`,
                  createdAt: new Date(clock.serverNow()).toISOString(),
                },
                ...rows,
              ];
        removed = rows.find((r) => same(r, item));
        return rows.filter((r) => !same(r, item));
      });
      if (!want) setLastRemoved(snapshot);
      setWriteError(null);
      pending.current += 1;
      const send = () => (want ? savedDb.save(userId, snapshot) : savedDb.unsave(userId, snapshot));
      const prev = chains.current.get(id) ?? Promise.resolve();
      const run = prev.then(send, send).then((r) => {
        const outcome = savedOutcome(r);
        if (outcome !== 'ok') {
          // Undo just this change, not a snapshot (other hearts may have changed meanwhile).
          qc.setQueryData<SavedItem[]>(key, (rows) => {
            if (rows === undefined) return rows;
            if (want) return rows.filter((r) => !same(r, item));
            const back = removed ?? { ...snapshot, id: `pending:${id}`, createdAt: '' };
            return rows.some((r) => same(r, item)) ? rows : [...rows, back].sort(newestFirst);
          });
          if (!want) setLastRemoved((l) => (l !== null && same(l, item) ? null : l));
          setWriteError(outcome);
        }
        return outcome;
      });
      const settled = run.catch((): WriteOutcome => 'transient');
      chains.current.set(id, settled);
      return settled.then((outcome) => {
        if (chains.current.get(id) === settled) chains.current.delete(id);
        pending.current -= 1;
        if (pending.current === 0) void qc.invalidateQueries({ queryKey: key });
        return outcome;
      });
    },
    [qc, userId],
  );

  const toggle = useCallback(
    (item: SavedInput) => write(item, !isSaved(item.kind, item.listingId)),
    [write, isSaved],
  );

  const undo = useCallback(async (): Promise<WriteOutcome | null> => {
    if (lastRemoved === null) return null;
    setLastRemoved(null);
    return write(lastRemoved, true);
  }, [lastRemoved, write]);

  return {
    items,
    ready: q.data !== undefined,
    loading: q.isPending && !loadFailed(q),
    error: loadFailed(q),
    refetch: q.refetch,
    isSaved,
    toggle,
    lastRemoved,
    undo,
    dismissUndo: () => {
      setLastRemoved(null);
    },
    writeError,
    clearWriteError: () => {
      setWriteError(null);
    },
  };
}
