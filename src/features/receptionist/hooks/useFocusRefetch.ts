import { useEffect, useRef } from 'react';

type Refetchable = { isStale: boolean; refetch: () => Promise<unknown> };

// R10 "refetch on screen focus": TanStack does not fetch when `refetchInterval` turns back on and
// tab screens stay mounted, so a tab regaining focus with stale data refetches here. Only the
// false → true edge counts; data going stale while the tab is already focused is the poll's job.
export function useFocusRefetch(isFocused: boolean, q: Refetchable): void {
  const wasFocused = useRef(isFocused);
  const { isStale, refetch } = q;
  useEffect(() => {
    const regained = isFocused && !wasFocused.current;
    wasFocused.current = isFocused;
    if (regained && isStale) void refetch();
  }, [isFocused, isStale, refetch]);
}
