import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createRosterStore } from '@/features/gate/offline/rosterStore';
import { refreshKeys, syncRoster, type FetchRosterPage } from '@/features/gate/offline/rosterSync';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import type { RosterPage } from '@/features/gate/schemas/roster';
import { toRosterRows } from '@/features/gate/schemas/roster';
import { err, ok } from '@/shared/lib/result';

const EV = 'e0000000-0000-4000-8000-000000000001';
const t = (n: number) => ({
  id: `00000000-0000-4000-8000-00000000000${String(n)}`,
  ticket_type: 'Regular',
  ticket_index: n,
  booking_id: 'b0000000-0000-4000-8000-000000000001',
  booking_status: 'confirmed',
  checked_in_at: null,
  scanned_by: null,
  by_me: null,
  holder_name: null,
  phone_masked: '0803••••210',
  seat: null,
});
const event = {
  id: EV,
  title: 'Gala',
  event_date: '2026-10-10',
  require_dynamic_ticket: false,
  total: 3,
  admitted: 0,
};
const page = (
  tickets: unknown[],
  next: string | null,
  over: Partial<RosterPage> = {},
): RosterPage => ({
  event,
  tickets,
  next_after: next,
  server_time: '2026-10-07T18:00:00.000000+00:00',
  ...over,
});

async function setup(pages: Parameters<FetchRosterPage>[0][] = []) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const store = createRosterStore(db);
  const calls = pages;
  return { store, calls };
}

describe('syncRoster', () => {
  it('downloads every page, then the list is ready', async () => {
    const { store, calls } = await setup();
    const responses = [
      ok(page([t(1), t(2)], t(2).id, { keys: [{ kid: 't', publicKey: 'k', signing: true }] })),
      ok(page([t(3)], null)),
    ];
    const fetchPage: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(responses.shift() ?? err({ kind: 'network' }));
    };
    const progress: number[] = [];
    const r = await syncRoster(
      { store, fetchPage, eventId: EV, onProgress: (p) => progress.push(p.done) },
      'delta',
    );
    expect(r).toEqual({ ok: true, kind: 'full' });
    expect(calls.map((c) => c.cursor)).toEqual([null, t(2).id]);
    expect(calls[0]?.since).toBeNull();
    expect(progress).toEqual([2, 3]);
    expect(await store.meta(EV)).toMatchObject({
      ready: true,
      keys: [{ kid: 't', publicKey: 'k' }],
    });
    expect(await store.counts(EV)).toEqual({ admitted: 0, total: 3 });
  });

  it('an interrupted download resumes from the saved cursor', async () => {
    const { store, calls } = await setup();
    const fetchPage: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(
        p.cursor === null ? ok(page([t(1)], t(1).id)) : err({ kind: 'timeout' }),
      );
    };
    expect(await syncRoster({ store, fetchPage, eventId: EV }, 'full')).toEqual({
      ok: false,
      error: { kind: 'timeout' },
    });
    const resumed: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(ok(page([t(2)], null)));
    };
    expect(await syncRoster({ store, fetchPage: resumed, eventId: EV }, 'delta')).toEqual({
      ok: true,
      kind: 'full',
    });
    expect(calls.map((c) => c.cursor)).toEqual([null, t(1).id, t(1).id]);
    expect(await store.counts(EV)).toEqual({ admitted: 0, total: 2 });
  });

  it('a delta asks for changes since the last sync and keeps the keys when the server has a key error', async () => {
    const { store, calls } = await setup();
    const first: FetchRosterPage = () =>
      Promise.resolve(
        ok(page([t(1)], null, { keys: [{ kid: 't', publicKey: 'k', signing: true }] })),
      );
    await syncRoster({ store, fetchPage: first, eventId: EV }, 'full');
    const delta: FetchRosterPage = (p) => {
      calls.push(p);
      return Promise.resolve(
        ok(page([t(2)], null, { keys: [], keys_error: true, server_time: '2026-10-07T18:03:00Z' })),
      );
    };
    expect(await syncRoster({ store, fetchPage: delta, eventId: EV }, 'delta')).toEqual({
      ok: true,
      kind: 'delta',
    });
    expect(calls[0]?.since).toBe('2026-10-07T18:00:00.000000+00:00');
    expect(await store.meta(EV)).toMatchObject({
      keys: [{ kid: 't', publicKey: 'k' }],
      sinceMark: '2026-10-07T18:03:00Z',
    });
  });

  it('stores the override verifier from the first page and keeps it when a resumed page omits it', async () => {
    const { store } = await setup();
    const v = { enabled: true, alg: 'scrypt' };
    const first: FetchRosterPage = (p) =>
      Promise.resolve(
        p.cursor === null ? ok(page([t(1)], t(1).id, { override: v })) : err({ kind: 'timeout' }),
      );
    await syncRoster({ store, fetchPage: first, eventId: EV }, 'full');
    expect((await store.meta(EV))?.override).toEqual(v);
    const resumed: FetchRosterPage = () => Promise.resolve(ok(page([t(2)], null)));
    await syncRoster({ store, fetchPage: resumed, eventId: EV }, 'full');
    expect((await store.meta(EV))?.override).toEqual(v);
  });

  it('refreshKeys fetches one row and stores the key set', async () => {
    const { store } = await setup();
    const first: FetchRosterPage = () => Promise.resolve(ok(page([t(1)], null, { keys: [] })));
    await syncRoster({ store, fetchPage: first, eventId: EV }, 'full');
    const keysOnly: FetchRosterPage = (p) =>
      Promise.resolve(
        ok(
          page(p.limit === 1 ? [t(1)] : [], null, {
            keys: [{ kid: 'u', publicKey: 'n', signing: true }],
          }),
        ),
      );
    expect(await refreshKeys({ store, fetchPage: keysOnly, eventId: EV })).toBe(true);
    expect((await store.meta(EV))?.keys).toEqual([{ kid: 'u', publicKey: 'n' }]);
  });
});

describe('toRosterRows', () => {
  it('maps fields and drops rows that are not tickets', () => {
    expect(toRosterRows([t(1), { id: 5 }])).toEqual({
      rows: [
        expect.objectContaining({
          id: t(1).id,
          bookingStatus: 'confirmed',
          phoneMasked: '0803••••210',
        }),
      ],
      dropped: 1,
    });
  });
});
