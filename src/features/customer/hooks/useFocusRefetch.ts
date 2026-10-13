import { useEffect, useRef } from 'react';

type Refetchable = { isStale: boolean; refetch: () => Promise<unknown> };

// "Refetch on screen focus" (C13, C17): TanStack doesn't fetch when a kept-mounted screen regains
// focus, so the false → true edge refetches stale data here. (Same rule as the desk's; features
// can't share code except through src/shared.)
export function useFocusRefetch(isFocused: boolean, q: Refetchable): void {
  const wasFocused = useRef(isFocused);
  const { isStale, refetch } = q;
  useEffect(() => {
    const regained = isFocused && !wasFocused.current;
    wasFocused.current = isFocused;
    if (regained && isStale) void refetch();
  }, [isFocused, isStale, refetch]);
}
