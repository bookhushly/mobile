import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';

const EV = 'e0000000-0000-4000-8000-000000000001';
const INFO = { title: 'Gala', eventDate: '2026-10-10', requireDynamic: true, total: 3 };
const KEYS = [{ kid: 't', publicKey: 'abc' }];
const MARK1 = '2026-10-07T18:00:00.123456+00:00';
const MARK2 = '2026-10-07T18:03:00.000000+00:00';
const row = (n: number, over: Partial<RosterRow> = {}): RosterRow => ({
  id: `00000000-0000-4000-8000-00000000000${String(n)}`,
  ticketType: 'Regular',
  ticketIndex: n,
  bookingId: 'b0000000-0000-4000-8000-000000000001',
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: null,
  phoneMasked: '0803••••210',
  seat: null,
  ...over,
});

async function setup() {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  return { db, store: createRosterStore(db) };
}

async function fullSync(store: ReturnType<typeof createRosterStore>, rows: RosterRow[], mark = MARK1) {
  await store.beginSync(EV, 'full', mark, INFO, KEYS);
  await store.writePage(EV, 'full', rows, null);
  await store.finishSync(EV, 'full');
}

describe('roster store', () => {
  it('a full sync is invisible until it finishes, then ready with keys and freshness', async () => {
    const { store } = await setup();
    await store.beginSync(EV, 'full', MARK1, INFO, KEYS);
    await store.writePage(EV, 'full', [row(1), row(2)], 'cursor-2');
    expect(await store.ticket(EV, row(1).id)).toBeNull();
    expect(await store.meta(EV)).toMatchObject({ ready: false, syncKind: 'full', cursor: 'cursor-2' });
    await store.writePage(EV, 'full', [row(3)], null);
    await store.finishSync(EV, 'full');
    const m = await store.meta(EV);
    expect(m).toMatchObject({
      ready: true,
      requireDynamic: true,
      total: 3,
      keys: KEYS,
      syncKind: null,
      cursor: null,
      sinceMark: MARK1,
      syncedAt: Date.parse('2026-10-07T18:00:00.123Z'),
      fullAt: Date.parse('2026-10-07T18:00:00.123Z'),
    });
    expect(await store.counts(EV)).toEqual({ admitted: 0, total: 3 });
  });

  it('a later full sync replaces the list (a cancelled booking disappears)', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1), row(2)]);
    await fullSync(store, [row(1)], MARK2);
    expect(await store.ticket(EV, row(2).id)).toBeNull();
  });

  it('decisions keep using the old list while a full refresh is staged', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1)]);
    await store.beginSync(EV, 'full', MARK2, INFO, KEYS);
    await store.writePage(EV, 'full', [row(2)], 'c');
    expect(await store.ticket(EV, row(1).id)).not.toBeNull();
    expect(await store.ticket(EV, row(2).id)).toBeNull();
  });

  it('the swap re-applies admissions made on this phone that the server has not seen yet', async () => {
    const { db, store } = await setup();
    await fullSync(store, [row(1), row(2)]);
    await db.run(
      "INSERT INTO outbox (event_id, ticket_id, code, scanned_at, mode, app_version, state) VALUES (?, ?, ?, ?, 'offline', '1', 'pending')",
      [EV, row(2).id, row(2).id, '2026-10-07T18:01:00.000Z'],
    );
    await fullSync(store, [row(1), row(2)], MARK2);
    expect(await store.ticket(EV, row(2).id)).toMatchObject({
      checkedInAt: '2026-10-07T18:01:00.000Z',
      byMe: true,
    });
  });

  it('a delta merges server admissions but never erases a local one', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1), row(2)]);
    await store.markCheckedIn(EV, row(1).id, '2026-10-07T18:01:00.000Z', true, null);
    await store.beginSync(EV, 'delta', MARK2, INFO, null);
    await store.writePage(
      EV,
      'delta',
      [row(1), row(2, { checkedInAt: '2026-10-07T18:02:00.000Z', scannedBy: 'Ada', byMe: false }), row(3)],
      null,
    );
    await store.finishSync(EV, 'delta');
    expect(await store.ticket(EV, row(1).id)).toMatchObject({ checkedInAt: '2026-10-07T18:01:00.000Z', byMe: true });
    expect(await store.ticket(EV, row(2).id)).toMatchObject({ scannedBy: 'Ada', byMe: false });
    expect(await store.ticket(EV, row(3).id)).not.toBeNull();
    expect(await store.meta(EV)).toMatchObject({ sinceMark: MARK2, keys: KEYS });
  });

  it('markCheckedIn only fills an empty admission', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1)]);
    await store.markCheckedIn(EV, row(1).id, '2026-10-07T18:01:00.000Z', true, null);
    await store.markCheckedIn(EV, row(1).id, '2026-10-07T18:09:00.000Z', false, 'Ada');
    expect(await store.ticket(EV, row(1).id)).toMatchObject({ checkedInAt: '2026-10-07T18:01:00.000Z' });
  });

  it('booking lookups and progress', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1), row(2, { checkedInAt: '2026-10-07T18:00:00Z' })]);
    expect(await store.hasBooking(EV, row(1).bookingId)).toBe(true);
    expect(await store.hasBooking(EV, row(1).id)).toBe(false);
    expect(await store.bookingProgress(EV, row(1).bookingId)).toEqual({ total: 2, checkedIn: 1 });
  });

  it('expiry and drop', async () => {
    const { store } = await setup();
    await fullSync(store, [row(1)]);
    await store.setEndsAt(EV, 1_000);
    expect(await store.expired(999)).toEqual([]);
    expect(await store.expired(1_001)).toEqual([EV]);
    await store.drop(EV);
    expect(await store.meta(EV)).toBeNull();
    expect(await store.ticket(EV, row(1).id)).toBeNull();
  });

  it('stores only the fields the endpoint returns (no email column exists)', async () => {
    const { db } = await setup();
    const cols = await db.all<{ name: string }>("SELECT name FROM pragma_table_info('roster_ticket')");
    expect(cols.map((c) => c.name).filter((n) => /mail|phone/.test(n))).toEqual(['phone_masked']);
  });
});
