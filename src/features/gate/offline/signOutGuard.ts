import { postBatch } from '@/features/gate/api/batch';
import { api } from '@/shared/api/instance';
import { registerSignOutGuard, type SignOutGuard } from '@/shared/lib/signOutGuard';
import { captureException } from '@/shared/monitoring';

import { syncOutbox } from './batchSync';
import { gateDb, hasGateDb, wipeGateDb } from './gateDb';

const gateGuard: SignOutGuard = {
  async check(userId) {
    if (!(await hasGateDb(userId))) return { unsynced: 0, unsyncable: 0 };
    return (await gateDb(userId)).outbox.totals();
  },
  async syncNow(userId) {
    if (!(await hasGateDb(userId))) return;
    const { outbox } = await gateDb(userId);
    for (const eventId of await outbox.eventsWithUnsynced()) {
      // The person is waiting to sign out: send now, even items that are backing off.
      await outbox.retryNow(eventId);
      await syncOutbox({
        store: outbox,
        eventId,
        post: (deviceId, items) => postBatch(api, eventId, deviceId, items),
        now: () => Date.now(),
        random: Math.random,
        report: captureException,
      });
    }
  },
  async summary(userId) {
    if (!(await hasGateDb(userId))) return null;
    const { device, outbox } = await gateDb(userId);
    const [tally, totals] = await Promise.all([device.tally(), outbox.totals()]);
    return { ...tally, toSync: totals.unsynced };
  },
  async resetSummary(userId) {
    if (!(await hasGateDb(userId))) return;
    await (await gateDb(userId)).device.resetTally();
  },
  wipe: wipeGateDb,
};

// Imported once for its side effect from src/app/_layout.tsx.
registerSignOutGuard(gateGuard);
