import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';

import { customerDb, withSessionRetry } from '@/features/customer/api/customerDb';
import {
  CustomerLoadError,
  customerKeys,
  NOTIFICATIONS_POLL_MS,
} from '@/features/customer/hooks/customerKeys';
import {
  refreshSession,
  writeOutcome,
  type WriteError,
  type WriteOutcome,
} from '@/features/customer/hooks/sessionWrite';
import { useFocusRefetch } from '@/features/customer/hooks/useFocusRefetch';
import type { NotificationRow } from '@/features/customer/schemas/notifications';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

function newestFirst(a: NotificationRow, b: NotificationRow): number {
  return a.created_at < b.created_at ? 1 : a.created_at > b.created_at ? -1 : 0;
}

export function useNotifications(userId: string): {
  items: NotificationRow[];
  unread: number;
  loading: boolean;
  error: boolean;
  refetch: () => Promise<unknown>;
  /** Marks it read (optimistically); the screen then opens its target. */
  open: (n: NotificationRow) => void;
  markUnread: (id: string) => void;
  markAllRead: () => void;
  /** Puts back what the last "Mark all as read" changed. */
  undoMarkAll: () => void;
  remove: (id: string) => void;
  writeError: WriteError | null;
  clearWriteError: () => void;
} {
  const qc = useQueryClient();
  const isFocused = useIsFocused();
  const q = useQuery({
    queryKey: customerKeys.notifications(userId),
    queryFn: async () => {
      const r = await customerDb.notifications(userId);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    refetchInterval: isFocused ? NOTIFICATIONS_POLL_MS : false,
    refetchOnWindowFocus: true,
  });
  useFocusRefetch(isFocused, q);
  const [writeError, setWriteError] = useState<WriteError | null>(null);
  const lastMarkedAll = useRef<string[]>([]);

  const items = useMemo(() => q.data ?? [], [q.data]);
  const unread = useMemo(() => items.filter((n) => !n.read).length, [items]);

  // Optimistic write: apply now, run it behind the C13 zero-row guard, and on failure undo just
  // this change (not a snapshot, which would also undo other writes made meanwhile).
  const write = useCallback(
    (
      apply: (rows: NotificationRow[]) => NotificationRow[],
      undo: (rows: NotificationRow[]) => NotificationRow[],
      send: () => Promise<Result<number, ApiError>>,
      expected: number,
    ): Promise<WriteOutcome> => {
      const k = customerKeys.notifications(userId);
      setWriteError(null);
      // A poll landing mid-write would overwrite the optimistic rows with the old ones.
      void qc.cancelQueries({ queryKey: k });
      qc.setQueryData<NotificationRow[]>(k, (rows) => (rows === undefined ? rows : apply(rows)));
      return withSessionRetry(send, expected, refreshSession).then((r) => {
        const outcome = writeOutcome(r);
        if (outcome !== 'ok') {
          qc.setQueryData<NotificationRow[]>(k, (rows) => (rows === undefined ? rows : undo(rows)));
          setWriteError(outcome);
        }
        void qc.invalidateQueries({ queryKey: k }, { cancelRefetch: false });
        return outcome;
      });
    },
    [qc, userId],
  );

  const setRead = useCallback(
    (ids: readonly string[], value: boolean) => {
      const set = new Set(ids);
      const to = (v: boolean) => (rows: NotificationRow[]) =>
        rows.map((n) => (set.has(n.id) ? { ...n, read: v } : n));
      return write(
        to(value),
        to(!value),
        () => (value ? customerDb.markRead(userId, ids) : customerDb.markUnread(userId, ids)),
        ids.length,
      );
    },
    [write, userId],
  );

  return {
    items,
    unread,
    loading: q.isPending,
    error: q.isError && q.data === undefined,
    refetch: q.refetch,
    open: (n) => {
      if (!n.read) void setRead([n.id], true);
    },
    markUnread: (id) => {
      if (items.some((n) => n.id === id && n.read)) void setRead([id], false);
    },
    markAllRead: () => {
      const ids = items.filter((n) => !n.read).map((n) => n.id);
      lastMarkedAll.current = ids;
      const set = new Set(ids);
      const to = (v: boolean) => (rows: NotificationRow[]) =>
        rows.map((n) => (set.has(n.id) ? { ...n, read: v } : n));
      void write(to(true), to(false), () => customerDb.markAllRead(userId), ids.length).then(
        (outcome) => {
          if (outcome !== 'ok') lastMarkedAll.current = [];
        },
      );
    },
    undoMarkAll: () => {
      const ids = lastMarkedAll.current;
      lastMarkedAll.current = [];
      if (ids.length > 0) void setRead(ids, false);
    },
    remove: (id) => {
      const gone = items.find((n) => n.id === id);
      if (gone === undefined) return;
      void write(
        (rows) => rows.filter((n) => n.id !== id),
        (rows) => (rows.some((n) => n.id === id) ? rows : [...rows, gone].sort(newestFirst)),
        () => customerDb.remove(userId, id),
        1,
      );
    },
    writeError,
    clearWriteError: () => {
      setWriteError(null);
    },
  };
}
