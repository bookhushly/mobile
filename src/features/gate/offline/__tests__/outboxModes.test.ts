import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const IN = '00000000-0000-4000-8000-000000000001';
const OUT = '00000000-0000-4000-8000-0000000000ff';
const row = (id: string): RosterRow => ({
  id, ticketType: 'VIP', ticketIndex: 1, bookingId: 'b', bookingStatus: 'confirmed', checkedInAt: null,
  scannedBy: null, byMe: null, holderName: 'Ada', phoneMasked: '0803••••210', seat: null,
});
const approval = { approvedBy: 'Tunde', reason: 'Bought at the door' };

async function setup() {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: true, total: 1 }, [], null);
  await roster.writePage(EV, 'full', [row(IN)], null);
  await roster.finishSync(EV, 'full');
  return { roster, outbox: createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' }) };
}
const base = { eventId: EV, scannedAt: '2026-10-07T18:00:00.000Z', appVersion: '1' };

describe('outbox modes', () => {
  it('a lookup admission records its mode and approval', async () => {
    const { outbox } = await setup();
    await outbox.recordAdmission({ ...base, ticketId: IN, code: IN, kid: null, mode: 'manual_lookup', approval: { approvedBy: 'Tunde', reason: null } });
    expect((await outbox.due(EV, 0, 10))[0]).toMatchObject({ mode: 'manual_lookup', approvedBy: 'Tunde', reason: null });
  });
  it('an override for an unlisted ticket writes only the outbox, once', async () => {
    const { outbox } = await setup();
    expect(await outbox.recordOverride({ ...base, ticketId: OUT, approval })).toEqual({ recorded: true, seq: 1 });
    expect(await outbox.recordOverride({ ...base, ticketId: OUT, approval })).toMatchObject({ recorded: false });
    expect(await outbox.due(EV, 0, 10)).toEqual([expect.objectContaining({ mode: 'offline_override', reason: 'Bought at the door', approvedBy: 'Tunde' })]);
  });
  it('an override for a ticket the list now has behaves like an admission', async () => {
    const { roster, outbox } = await setup();
    expect(await outbox.recordOverride({ ...base, ticketId: IN, approval })).toMatchObject({ recorded: true });
    expect(await roster.ticket(EV, IN)).toMatchObject({ byMe: true });
    expect(await outbox.recordOverride({ ...base, ticketId: IN, approval })).toMatchObject({ recorded: false, ticket: { id: IN } });
  });
  it('lists by tab, newest first, with paging, and exports rows', async () => {
    const { outbox } = await setup();
    await outbox.recordOverride({ ...base, ticketId: OUT, approval });
    await outbox.recordAdmission({ ...base, ticketId: IN, code: IN, kid: null });
    expect((await outbox.list(EV, 'toSync', null, 10)).map((i) => i.seq)).toEqual([2, 1]);
    expect((await outbox.list(EV, 'toSync', 2, 10)).map((i) => i.seq)).toEqual([1]);
    expect(await outbox.list(EV, 'synced', null, 10)).toEqual([]);
    const rows = await outbox.exportRows(EV);
    expect(rows.map((r) => r.mode)).toEqual(['offline_override', 'offline']);
    expect(rows[1]).toMatchObject({ ticketType: 'VIP', ticketIndex: 1 });
    expect(JSON.stringify(rows)).not.toContain('Ada');
  });
});
