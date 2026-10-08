import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { LOCK_MS } from '@/features/gate/domain/overrideLock';
import { createDeviceStore, EMPTY_TALLY } from '@/features/gate/offline/deviceStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import { memoryKv } from '@/shared/lib/kv';

async function freshDb() {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  return db;
}

it('keeps the lockout and the shift tally', async () => {
  const db = await freshDb();
  const lockKv = memoryKv();
  const d = createDeviceStore(db, { lockKv });
  expect(await d.lock()).toEqual({ failures: 0, lockedUntil: null });
  await d.setLock({ failures: 5, lockedUntil: 123 });
  expect(await createDeviceStore(db, { lockKv }).lock()).toEqual({ failures: 5, lockedUntil: 123 });
  expect(await d.tally()).toEqual(EMPTY_TALLY);
  await d.addToTally('admitted');
  await d.addToTally('admitted');
  await d.addToTally('refused');
  expect(await d.tally()).toEqual({ ...EMPTY_TALLY, admitted: 2, refused: 1 });
  await d.resetTally();
  expect(await d.tally()).toEqual(EMPTY_TALLY);
});

it('the lockout survives the database being wiped', async () => {
  const lockKv = memoryKv();
  await createDeviceStore(await freshDb(), { lockKv }).setLock({ failures: 5, lockedUntil: 999 });
  expect(await createDeviceStore(await freshDb(), { lockKv }).lock()).toEqual({ failures: 5, lockedUntil: 999 });
});

it('an unreadable lock record fails closed, is saved, and so expires', async () => {
  const NOW = 1_000;
  const lockKv = memoryKv();
  await lockKv.set('override_lock', 'garbage');
  let t = NOW;
  const d = createDeviceStore(await freshDb(), { now: () => t, lockKv });
  expect(await d.lock()).toEqual({ failures: 5, lockedUntil: NOW + LOCK_MS });
  t = NOW + 60_000;
  expect(await d.lock()).toEqual({ failures: 5, lockedUntil: NOW + LOCK_MS });
});
