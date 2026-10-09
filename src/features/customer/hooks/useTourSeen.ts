import { useCallback, useEffect, useState } from 'react';

import { secureKv } from '@/shared/platform/secureStore';

export function tourKey(userId: string): string {
  return `bh.tour.${userId}`;
}

const SEEN = '1';

type Known = { userId: string; seen: boolean };

// Once per account per device. `seen` is null until the store answers (callers render nothing
// tour-related meanwhile, so the tour never flashes); a failed read counts as seen because a
// tour must never block the app.
export function useTourSeen(userId: string | null): {
  seen: boolean | null;
  markSeen: () => void;
} {
  const [known, setKnown] = useState<Known | null>(null);
  useEffect(() => {
    if (userId === null) return;
    let live = true;
    secureKv
      .get(tourKey(userId))
      .then((v) => {
        if (live) setKnown({ userId, seen: v === SEEN });
      })
      .catch(() => {
        if (live) setKnown({ userId, seen: true });
      });
    return () => {
      live = false;
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
