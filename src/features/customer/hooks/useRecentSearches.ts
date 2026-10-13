import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';

import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { isSignedInAs } from '@/features/customer/hooks/sessionWrite';
import { recentSearches, type RecentSearch } from '@/features/customer/offline/recentSearches';

// Spec D7: on this device, per user, up to 8. Read from disk, so it runs offline too.
export function useRecentSearches(userId: string): {
  items: RecentSearch[];
  add: (e: RecentSearch) => Promise<void>;
  remove: (e: RecentSearch) => Promise<void>;
} {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: customerKeys.recentSearches(userId),
    queryFn: () => recentSearches.get(userId),
    networkMode: 'always',
    staleTime: Infinity,
    enabled: userId !== '',
  });
  const reload = useCallback(
    () => qc.invalidateQueries({ queryKey: customerKeys.recentSearches(userId) }),
    [qc, userId],
  );
  const add = useCallback(
    async (e: RecentSearch) => {
      if (userId === '') return;
      // Checked inside the write queue: the sign-out wipe is never undone by a late add.
      await recentSearches.add(userId, e, () => isSignedInAs(userId));
      await reload();
    },
    [userId, reload],
  );
  const remove = useCallback(
    async (e: RecentSearch) => {
      if (userId === '') return;
      await recentSearches.remove(userId, e, () => isSignedInAs(userId));
      await reload();
    },
    [userId, reload],
  );
  return { items: q.data ?? [], add, remove };
}
