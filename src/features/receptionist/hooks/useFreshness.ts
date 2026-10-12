import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';

// `updatedAt` is TanStack's `dataUpdatedAt` (wall-clock ms, 0 before the first load), so the age
// is measured on the same clock. R10: a small line once the data is older than 2 minutes.
const SHOW_AFTER_MS = 2 * 60_000;
const TICK_MS = 30_000;

export function freshnessLabel(updatedAt: number, now: number): string | null {
  if (updatedAt === 0) return null;
  const age = now - updatedAt;
  if (age < SHOW_AFTER_MS) return null;
  return `Updated ${String(Math.floor(age / 60_000))} min ago`;
}

export function useFreshness(updatedAt: number): string | null {
  // `now` only moves on the tick. A load newer than the last tick has a negative age, so the line
  // clears at once without a synchronous state write.
  const [now, setNow] = useState(() => Date.now());
  // Tab screens stay mounted: tick only while this one is on screen, catching up as it returns.
  const isFocused = useIsFocused();
  const ticking = updatedAt !== 0 && isFocused;
  useEffect(() => {
    if (!ticking) return;
    const tick = () => {
      setNow(Date.now());
    };
    const first = setTimeout(tick, 0);
    const t = setInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [ticking]);
  return freshnessLabel(updatedAt, now);
}
