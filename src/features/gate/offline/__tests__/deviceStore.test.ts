import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createDeviceStore, EMPTY_TALLY } from '@/features/gate/offline/deviceStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

it('keeps the lockout and the shift tally', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const d = createDeviceStore(db);
  expect(await d.lock()).toEqual({ failures: 0, lockedUntil: null });
  await d.setLock({ failures: 5, lockedUntil: 123 });
  expect(await createDeviceStore(db).lock()).toEqual({ failures: 5, lockedUntil: 123 });
  expect(await d.tally()).toEqual(EMPTY_TALLY);
  await d.addToTally('admitted');
  await d.addToTally('admitted');
  await d.addToTally('refused');
  expect(await d.tally()).toEqual({ ...EMPTY_TALLY, admitted: 2, refused: 1 });
  await d.resetTally();
  expect(await d.tally()).toEqual(EMPTY_TALLY);
});

it('an unreadable lock record fails closed', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  await db.run("INSERT INTO device (k, v) VALUES ('override_lock', 'garbage')");
  const rec = await createDeviceStore(db, { now: () => 1_000 }).lock();
  expect(rec.lockedUntil).not.toBeNull();
});
