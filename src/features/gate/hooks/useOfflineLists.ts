import { useEffect, useState } from 'react';

import { gateDb, hasGateDb } from '@/features/gate/offline/gateDb';
import { captureException } from '@/shared/monitoring';

const NONE: ReadonlySet<string> = new Set();

// Which events have a finished offline list on this phone. Never blocks or fails the event list.
export function useOfflineLists(userId: string | null): ReadonlySet<string> {
  const [ids, setIds] = useState<ReadonlySet<string>>(NONE);
  useEffect(() => {
    if (userId === null) return;
    const sub = { live: true };
    void (async () => {
      try {
        if (!(await hasGateDb(userId))) return;
        const db = await gateDb(userId);
        const list = await db.roster.readyEventIds();
        if (sub.live) setIds(new Set(list));
      } catch (e) {
        captureException(e);
      }
    })();
    return () => {
      sub.live = false;
    };
  }, [userId]);
  return ids;
}
