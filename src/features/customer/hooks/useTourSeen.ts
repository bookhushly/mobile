import { useCallback, useEffect, useState } from 'react';

import { secureKv } from '@/shared/platform/secureStore';

export function tourKey(userId: string): string {
  return `bh.tour.${userId}`;
}

const SEEN = '1';

type Known = { userId: string; seen: boolean };

/**
 * Re-review L2: a keychain read that hasn't answered by now counts as seen, so the tabs' neutral
 * gate never becomes a blank screen. A late answer is then ignored (the tour never pops up later).
 */
export const TOUR_READ_TIMEOUT_MS = 1_500;

// Once per account per device. `seen` is null until the store answers (callers render nothing
// tour-related meanwhile, so the tour never flashes); a failed or slow read counts as seen
// because a tour must never block the app.
export function useTourSeen(userId: string | null): {
  seen: boolean | null;
  markSeen: () => void;
} {
  const [known, setKnown] = useState<Known | null>(null);
  useEffect(() => {
    if (userId === null) return;
    let live = true;
    const settle = (seen: boolean) => {
      if (!live) return;
      live = false;
      clearTimeout(timer);
      setKnown({ userId, seen });
    };
    const timer = setTimeout(() => {
      settle(true);
    }, TOUR_READ_TIMEOUT_MS);
    secureKv
      .get(tourKey(userId))
      .then((v) => {
        settle(v === SEEN);
      })
      .catch(() => {
        settle(true);
      });
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [userId]);
  const markSeen = useCallback(() => {
    if (userId === null) return;
    setKnown({ userId, seen: true });
    secureKv.set(tourKey(userId), SEEN).catch(() => {
      // Best effort: the tour shows again next launch at worst.
    });
  }, [userId]);
  const seen = known !== null && known.userId === userId ? known.seen : null;
  return { seen, markSeen };
}
