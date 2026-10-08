import { useCallback, useEffect, useState } from 'react';

import { gateDb, hasGateDb } from '@/features/gate/offline/gateDb';
import { captureException } from '@/shared/monitoring';

const NONE: ReadonlySet<string> = new Set();

type OfflineLists = { lists: ReadonlySet<string>; reload: () => void };

// Which events have a finished offline list on this phone. Never blocks or fails the event list.
// Re-reads whenever the screen regains focus (a list may have been downloaded on the detail
// screen, or the gate DB may not have existed at mount) and on an explicit reload.
export function useOfflineLists(userId: string | null, focused: boolean): OfflineLists {
  const [lists, setLists] = useState<ReadonlySet<string>>(NONE);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => {
    setTick((t) => t + 1);
  }, []);
  useEffect(() => {
    if (userId === null || !focused) return;
    const sub = { live: true };
    void (async () => {
      try {
        if (!(await hasGateDb(userId))) return;
        const db = await gateDb(userId);
        const list = await db.roster.readyEventIds();
        if (sub.live) setLists(new Set(list));
      } catch (e) {
        captureException(e);
      }
    })();
    return () => {
      sub.live = false;
    };
  }, [userId, focused, tick]);
  return { lists, reload };
}
