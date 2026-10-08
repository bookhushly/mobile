import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { sweepExpired } from '@/features/gate/offline/gateDb';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

jest.mock('@/shared/db/expoSql', () => ({}));
jest.mock('@/shared/platform/secureStore', () => ({ secureKv: {} }));
jest.mock('expo-crypto', () => ({}));

const EV = 'e0000000-0000-4000-8000-000000000001';
const T = '00000000-0000-4000-8000-000000000001';

it('drops expired lists only once their admissions have synced', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  const outbox = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  await roster.beginSync(
    EV,
    'full',
    '2026-10-07T17:00:00Z',
    { title: null, eventDate: null, requireDynamic: false, total: 1 },
    [],
  );
  await roster.writePage(
    EV,
    'full',
    [
      {
        id: T,
        ticketType: null,
        ticketIndex: 1,
        bookingId: 'b',
        bookingStatus: 'confirmed',
        checkedInAt: null,
        scannedBy: null,
        byMe: null,
        holderName: null,
        phoneMasked: null,
        seat: null,
      },
    ],
    null,
  );
  await roster.finishSync(EV, 'full');
  await roster.setEndsAt(EV, 1_000);
  await outbox.recordAdmission({
    eventId: EV,
    ticketId: T,
    code: T,
    scannedAt: 'x',
    kid: null,
    appVersion: '1',
  });
  await sweepExpired(roster, outbox, 2_000);
  expect(await roster.meta(EV)).not.toBeNull();
  await outbox.markSending([1]);
  await outbox.settle([{ seq: 1, state: 'synced', result: null }]);
  await sweepExpired(roster, outbox, 2_000);
  expect(await roster.meta(EV)).toBeNull();
});
