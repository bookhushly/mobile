import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const row = (n: number, over: Partial<RosterRow> = {}): RosterRow => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  ticketType: 'Regular',
  ticketIndex: 1,
  bookingId: `b0000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: null,
  phoneMasked: null,
  seat: null,
  ...over,
});

async function setup(rows: RosterRow[]) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const store = createRosterStore(db);
  await store.beginSync(
    EV,
    'full',
    '2026-10-07T17:00:00Z',
    { title: null, eventDate: null, requireDynamic: false, total: rows.length },
    [],
    null,
  );
  await store.writePage(EV, 'full', rows, null);
  await store.finishSync(EV, 'full');
  return store;
}

describe('roster search', () => {
  it('finds by name, case-insensitively, anywhere in the name', async () => {
    const s = await setup([row(1, { holderName: 'Ada Obi' }), row(2, { holderName: 'Tunde' })]);
    expect((await s.search(EV, { kind: 'name', value: 'obi' })).map((r) => r.holderName)).toEqual([
      'Ada Obi',
    ]);
  });
  it('finds a precomposed name from a decomposed (NFD) query', async () => {
    const s = await setup([row(1, { holderName: 'Ọlá' }), row(2, { holderName: 'Tunde' })]);
    expect(
      (await s.search(EV, { kind: 'name', value: 'Ọlá'.normalize('NFD') })).map(
        (r) => r.holderName,
      ),
    ).toEqual(['Ọlá']);
  });
  it('finds by the visible head or tail of a masked phone', async () => {
    const s = await setup([
      row(1, { phoneMasked: '0803••••210' }),
      row(2, { phoneMasked: '0812••••555' }),
    ]);
    expect((await s.search(EV, { kind: 'phoneTail', value: '210' })).length).toBe(1);
    expect((await s.search(EV, { kind: 'phoneTail', value: '10' })).length).toBe(1);
    expect((await s.search(EV, { kind: 'phoneHead', value: '0812' })).length).toBe(1);
  });
  it('matches SQL wildcards literally', async () => {
    const s = await setup([row(1, { holderName: 'Ada' }), row(2, { holderName: '50%_off\\' })]);
    expect((await s.search(EV, { kind: 'name', value: '%_' })).map((r) => r.holderName)).toEqual([
      '50%_off\\',
    ]);
  });
  it('caps results at 50, not-yet-in first', async () => {
    const rows = Array.from({ length: 60 }, (_, i) =>
      row(i + 1, { holderName: `Guest ${String(i)}`, checkedInAt: i < 30 ? 'x' : null }),
    );
    const res = await setup(rows).then((s) => s.search(EV, { kind: 'name', value: 'guest' }));
    expect(res).toHaveLength(50);
    expect(res[0]?.checkedInAt).toBeNull();
  });
  it('lists a booking’s tickets in order', async () => {
    const b = 'b0000000-0000-4000-8000-00000000000b';
    const s = await setup([
      row(1, { bookingId: b, ticketIndex: 2 }),
      row(2, { bookingId: b, ticketIndex: 1 }),
    ]);
    expect((await s.bookingTickets(EV, b)).map((r) => r.ticketIndex)).toEqual([1, 2]);
  });
  it('stores, keeps and clears the override verifier', async () => {
    const s = await setup([row(1)]);
    const v = { enabled: true, alg: 'scrypt' };
    await s.beginSync(
      EV,
      'delta',
      '2026-10-07T17:05:00Z',
      { title: null, eventDate: null, requireDynamic: false, total: 1 },
      null,
      v,
    );
    await s.finishSync(EV, 'delta');
    expect((await s.meta(EV))?.override).toEqual(v);
    await s.beginSync(
      EV,
      'delta',
      '2026-10-07T17:06:00Z',
      { title: null, eventDate: null, requireDynamic: false, total: 1 },
      null,
      undefined,
    );
    await s.finishSync(EV, 'delta');
    expect((await s.meta(EV))?.override).toEqual(v);
    await s.beginSync(
      EV,
      'delta',
      '2026-10-07T17:07:00Z',
      { title: null, eventDate: null, requireDynamic: false, total: 1 },
      null,
      null,
    );
    await s.finishSync(EV, 'delta');
    expect((await s.meta(EV))?.override).toBeNull();
  });
});
