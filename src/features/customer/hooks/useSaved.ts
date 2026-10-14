import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo, useState } from 'react';

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
  ...(s.createdAt !== undefined ? { createdAt: s.createdAt } : {}),
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
  /** The last unsaved item (with its original date), for the Undo banner. */
  lastRemoved: SavedInput | null;
  /** Saves `lastRemoved` again, after its unsave has finished. */
  undo: () => Promise<WriteOutcome | null>;
  dismissUndo: () => void;
  /** 'stale' → the neutral "Sign in again" banner; 'transient' → "Check your connection". */
  writeError: WriteError | null;
  clearWriteError: () => void;
};

// One write queue per account, shared by every useSaved on screen (Explore rails, Saved tab,
// listing detail all mount at once and tabs stay mounted): writes for one listing run one at a
// time in tap order, whichever screen they came from, and the list refetches only once every
// write for the account has settled, so a refetch never overwrites a heart still being written.
type Queue = { chains: Map<string, Promise<WriteOutcome>>; pending: number };
const queues = new Map<string, Queue>();
function queueFor(userId: string): Queue {
  let q = queues.get(userId);
  if (q === undefined) {
    q = { chains: new Map(), pending: 0 };
    queues.set(userId, q);
  }
  return q;
}

// Spec D9: saved_listings under RLS, keyed by user. A quick save → unsave can never land the
// other way round (see the queue above).
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
    enabled: userId !== '',
  });
  const [lastRemoved, setLastRemoved] = useState<SavedInput | null>(null);
  const [writeError, setWriteError] = useState<WriteError | null>(null);

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
      // Read before the optimistic removal: the row's own date goes with the Undo offer (F5).
      const removedAt = want
        ? undefined
        : qc.getQueryData<SavedItem[]>(key)?.find((r) => same(r, item))?.createdAt;
      void qc.cancelQueries({ queryKey: key });
      qc.setQueryData<SavedItem[]>(key, (rows) => {
        if (rows === undefined) return rows;
        if (want) {
          if (rows.some((r) => same(r, item))) return rows;
          // An Undo carries the row's own date and goes back to its place (F5); a new save is
          // the newest.
          const at = snapshot.createdAt;
          const added = {
            ...snapshot,
            id: `pending:${id}`,
            createdAt: at ?? new Date(clock.serverNow()).toISOString(),
          };
          return at === undefined ? [added, ...rows] : [...rows, added].sort(newestFirst);
        }
        removed = rows.find((r) => same(r, item));
        return rows.filter((r) => !same(r, item));
      });
      if (!want)
        setLastRemoved(removedAt === undefined ? snapshot : { ...snapshot, createdAt: removedAt });
      setWriteError(null);
      const queue = queueFor(userId);
      queue.pending += 1;
      const send = () => (want ? savedDb.save(userId, snapshot) : savedDb.unsave(userId, snapshot));
      const prev = queue.chains.get(id) ?? Promise.resolve();
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
      queue.chains.set(id, settled);
      return settled.then((outcome) => {
        if (queue.chains.get(id) === settled) queue.chains.delete(id);
        queue.pending -= 1;
        if (queue.pending === 0) {
          if (queues.get(userId) === queue) queues.delete(userId);
          void qc.invalidateQueries({ queryKey: key });
        }
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
