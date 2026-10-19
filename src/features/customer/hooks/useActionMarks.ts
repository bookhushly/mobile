import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { isSignedInAs } from '@/features/customer/hooks/sessionWrite';
import { refundMarks, reviewedMarks, type MarkSet } from '@/features/customer/offline/actionMarks';

export type Marks = {
  /** False until the device has answered (and for an id never marked). */
  has: (id: string) => boolean;
  /** Remembers `id` now (memory) and on disk, only while `userId` is still signed in. */
  mark: (id: string) => Promise<void>;
};

const NONE: readonly string[] = [];

function useMarks(userId: string, set: MarkSet, keyOf: (u: string) => readonly unknown[]): Marks {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: keyOf(userId),
    queryFn: () => set.get(userId),
    networkMode: 'always',
    staleTime: Infinity,
    enabled: userId !== '',
  });
  const known = useMemo(() => new Set(q.data ?? NONE), [q.data]);
  const has = useCallback((id: string) => known.has(id), [known]);
  const mark = useCallback(
    async (id: string) => {
      if (userId === '') return;
      // In memory at once: the screen reads "Reviewed" even if the disk write is slow or fails.
      // A first read still in flight would overwrite it with the older list: stop it first.
      await qc.cancelQueries({ queryKey: keyOf(userId) });
      qc.setQueryData<string[]>(keyOf(userId), (ids) =>
        ids === undefined ? [id] : ids.includes(id) ? ids : [...ids, id],
      );
      try {
        await set.add(userId, id, () => isSignedInAs(userId));
      } catch {
        // Best effort: a lost mark costs a re-post that the server answers with 409.
      }
    },
    [qc, set, keyOf, userId],
  );
  return { has, mark };
}

/** Spec E8: listing ids this customer has reviewed (plainKv `bh.reviewed.<uid>`). */
export function useReviewedSet(userId: string): Marks {
  return useMarks(userId, reviewedMarks, customerKeys.reviewed);
}

/** Spec E6: event bookings with a refund request sent (plainKv `bh.refund-req.<uid>`). */
export function useRefundRequested(userId: string): Marks {
  return useMarks(userId, refundMarks, customerKeys.refundRequested);
}
