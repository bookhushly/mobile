import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createOutboxStore, type AdmissionInput } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const T1 = '00000000-0000-4000-8000-000000000001';
const T2 = '00000000-0000-4000-8000-000000000002';
const row = (id: string): RosterRow => ({
  id,
  ticketType: 'Regular',
  ticketIndex: 1,
  bookingId: 'b0000000-0000-4000-8000-000000000001',
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: null,
  phoneMasked: null,
  seat: null,
});
const input = (ticketId: string, over: Partial<AdmissionInput> = {}): AdmissionInput => ({
  eventId: EV,
  ticketId,
  code: ticketId,
  scannedAt: '2026-10-07T18:00:00.000Z',
  kid: null,
  appVersion: '1.0.0 (7)',
  ...over,
});

async function setup() {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: 2 }, []);
  await roster.writePage(EV, 'full', [row(T1), row(T2)], null);
  await roster.finishSync(EV, 'full');
  let n = 0;
  const outbox = createOutboxStore(db, { newDeviceId: () => `device-${String(++n)}-abcdef` });
  return { db, roster, outbox };
}

describe('outbox store', () => {
  it('records the roster admission and the outbox row together, with rising client_seq', async () => {
    const { roster, outbox } = await setup();
    expect(await outbox.recordAdmission(input(T1))).toEqual({ recorded: true, seq: 1 });
    expect(await outbox.recordAdmission(input(T2))).toEqual({ recorded: true, seq: 2 });
    expect(await roster.ticket(EV, T1)).toMatchObject({ checkedInAt: '2026-10-07T18:00:00.000Z', byMe: true });
    expect((await outbox.due(EV, 0, 10)).map((i) => i.seq)).toEqual([1, 2]);
  });

  it('a second admission of the same ticket is refused with the stored ticket', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    const again = await outbox.recordAdmission(input(T1, { code: 'BH2.other' }));
    expect(again).toMatchObject({ recorded: false, ticket: { id: T1, byMe: true } });
    expect(await outbox.due(EV, 0, 10)).toHaveLength(1);
  });

  it('nothing is written when the outbox insert fails (one transaction)', async () => {
    const { db, roster, outbox } = await setup();
    await db.exec('DROP TABLE outbox');
    await expect(outbox.recordAdmission(input(T1))).rejects.toThrow();
    expect(await roster.ticket(EV, T1)).toMatchObject({ checkedInAt: null });
  });

  it('the device id is generated once and kept', async () => {
    const { outbox } = await setup();
    const a = await outbox.deviceId();
    expect(await outbox.deviceId()).toBe(a);
    expect(a).toMatch(/^[A-Za-z0-9_-]{8,64}$/);
  });

  it('due respects order, state and next_try_at; sending items reset at startup', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    await outbox.recordAdmission(input(T2));
    await outbox.markSending([1]);
    expect((await outbox.due(EV, 0, 10)).map((i) => i.seq)).toEqual([2]);
    await outbox.retryLater([2], 5_000);
    expect(await outbox.due(EV, 4_999, 10)).toEqual([]);
    expect((await outbox.due(EV, 5_000, 10))[0]).toMatchObject({ seq: 2, attempts: 1 });
    await outbox.resetSending();
    expect((await outbox.due(EV, 5_000, 10)).map((i) => i.seq)).toEqual([1, 2]);
  });

  it('settle, attention, status and totals', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    await outbox.recordAdmission(input(T2));
    await outbox.settle([{ seq: 1, state: 'duplicate', result: { scanned_by: 'Ada' } }]);
    expect(await outbox.status(EV)).toEqual({ pending: 1, attention: 1, blocked: false, nextTryAt: 0 });
    expect(await outbox.attention(EV)).toEqual([
      expect.objectContaining({ seq: 1, state: 'duplicate', result: { scanned_by: 'Ada' }, ticketType: 'Regular' }),
    ]);
    await outbox.markSending([2]);
    expect(await outbox.totals()).toEqual({ unsynced: 1, unsyncable: 0 });
    expect(await outbox.eventsWithUnsynced()).toEqual([EV]);
  });

  it('a revoked assignment blocks the unsynced items; they count as unsyncable', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission(input(T1));
    await outbox.blockEvent(EV);
    expect(await outbox.status(EV)).toMatchObject({ pending: 0, blocked: true });
    expect(await outbox.totals()).toEqual({ unsynced: 0, unsyncable: 1 });
    expect(await outbox.hasUnsynced(EV)).toBe(false);
  });
});
