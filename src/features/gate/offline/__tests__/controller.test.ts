import { parseTicketCode } from '@/features/gate/domain/parseTicketCode';
import { DatabaseTooNewError, migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createOfflineController, type ControllerDeps } from '@/features/gate/offline/controller';
import { createDeviceStore } from '@/features/gate/offline/deviceStore';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import type { SyncStatus } from '@/features/gate/domain/syncLine';
import { memoryKv } from '@/shared/lib/kv';
import { createConnectivity } from '@/shared/lib/connectivity';
import { ok } from '@/shared/lib/result';

const EV = 'e0000000-0000-4000-8000-000000000001';
const T = '00000000-0000-4000-8000-000000000001';
// A real TicketCode, minted the only way the app mints one (no type escapes).
const TICKET = (() => {
  const parsed = parseTicketCode(T);
  if (parsed === null) throw new Error('test ticket code does not parse');
  return parsed.value;
})();
const flush = () => new Promise<void>((r) => setImmediate(r));
// Known-answer verifier for PIN 123456 (see overridePin tests).
const KAT = {
  enabled: true,
  alg: 'scrypt',
  N: 8192,
  r: 8,
  p: 1,
  dk_len: 32,
  salt: 'ABEiM0RVZneImaq7zN3u_w',
  hash: 'L8yIIos_9EAoJkqiN2s2Qv6pNMzKe65LM05K0fZtgeA',
};
const page = {
  event: {
    id: EV,
    title: 'Gala',
    event_date: '2026-10-10',
    require_dynamic_ticket: false,
    total: 1,
  },
  tickets: [
    {
      id: T,
      ticket_type: 'Regular',
      ticket_index: 1,
      booking_id: 'b',
      booking_status: 'confirmed',
      checked_in_at: null,
      scanned_by: null,
      by_me: null,
      holder_name: null,
      phone_masked: null,
      seat: null,
    },
  ],
  next_after: null,
  server_time: '2026-10-07T18:00:00Z',
  keys: [],
};

async function setup(over: Partial<ControllerDeps> = {}, pageOver: Record<string, unknown> = {}) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const stores = {
    roster: createRosterStore(db),
    outbox: createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' }),
    device: createDeviceStore(db, { lockKv: memoryKv() }),
    close: () => Promise.resolve(),
  };
  const status: Partial<SyncStatus>[] = [];
  const connectivity = createConnectivity();
  const fetchPage = jest.fn(() => Promise.resolve(ok({ ...page, ...pageOver })));
  const post = jest.fn(() =>
    Promise.resolve(ok({ results: [{ client_seq: 1, ok: true, code: 'ok' }] })),
  );
  const ctl = createOfflineController({
    eventId: EV,
    db: () => Promise.resolve(stores),
    fetchPage,
    post,
    serverNow: () => Date.parse('2026-10-07T18:00:10Z'),
    clockState: () => ({ suspect: false, checkedAgoMs: 0 }),
    connectivity,
    endsAt: () => null,
    appVersion: '1',
    random: () => 1,
    publish: (s) => status.push(s),
    report: jest.fn(),
    ...over,
  });
  return { ctl, stores, status, fetchPage, post, connectivity };
}

describe('offline controller', () => {
  it('start downloads the list and publishes it', async () => {
    const { ctl, fetchPage, status } = await setup();
    ctl.start();
    await flush();
    await flush();
    expect(fetchPage).toHaveBeenCalledWith({ cursor: null, since: null, limit: 2000 });
    expect(status).toContainEqual(
      expect.objectContaining({ list: { count: 1, syncedAt: Date.parse('2026-10-07T18:00:00Z') } }),
    );
    ctl.stop();
  });

  it('after stop, in-flight work finishes without publishing', async () => {
    const { ctl, status, fetchPage } = await setup();
    ctl.start();
    ctl.stop();
    const before = status.length;
    for (let i = 0; i < 6; i++) await flush();
    expect(fetchPage).toHaveBeenCalled();
    expect(status).toHaveLength(before);
  });

  it('an offline admission is synced when the server is back', async () => {
    const { ctl, post, connectivity } = await setup();
    ctl.start();
    await flush();
    await flush();
    connectivity.networkLost();
    const o = await ctl.decide(TICKET);
    expect(o).toMatchObject({ kind: 'admitted', offline: true });
    post.mockClear();
    connectivity.reached();
    await flush();
    await flush();
    expect(post).toHaveBeenCalled();
    ctl.stop();
  });

  it('asks for keys at most once a minute', async () => {
    const { ctl, fetchPage } = await setup();
    ctl.start();
    await flush();
    await flush();
    fetchPage.mockClear();
    ctl.keysOutdated();
    ctl.keysOutdated();
    await flush();
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(fetchPage).toHaveBeenCalledWith({ cursor: null, since: null, limit: 1 });
    ctl.stop();
  });

  it('a database from a newer app version publishes appOutdated', async () => {
    const { ctl, status } = await setup({
      db: () => Promise.reject(new DatabaseTooNewError(3, 2)),
    });
    ctl.start();
    await flush();
    await flush();
    expect(status).toContainEqual({ appOutdated: true, mode: 'online' });
    ctl.stop();
  });

  // Offline-scan review 2026-11-23 (S1): opened while already offline, the pill must not say Online.
  it('a database from a newer app version, opened while offline, says offline', async () => {
    const { ctl, status } = await setup({
      db: () => Promise.reject(new DatabaseTooNewError(3, 2)),
      connectivity: { isDegraded: () => true, subscribe: () => () => undefined },
    });
    ctl.start();
    await flush();
    await flush();
    expect(status).toContainEqual({ appOutdated: true, mode: 'offline' });
    expect(status).not.toContainEqual(expect.objectContaining({ mode: 'online' }));
    ctl.stop();
  });

  // Offline-scan review 2026-11-23 (S2): "scan again" can never work here; say "update the app".
  it('a scan decided on a database from a newer app version says the app needs an update', async () => {
    const { ctl, status } = await setup({
      db: () => Promise.reject(new DatabaseTooNewError(3, 2)),
    });
    await expect(ctl.decide(TICKET)).resolves.toEqual({
      kind: 'couldntCheck',
      cause: 'appOutdated',
    });
    expect(status).toContainEqual(expect.objectContaining({ appOutdated: true }));
  });

  it('a database from a newer app version is reported once, however often it fails', async () => {
    const report = jest.fn();
    const { ctl } = await setup({
      db: () => Promise.reject(new DatabaseTooNewError(3, 2)),
      report,
    });
    ctl.start();
    await flush();
    await flush();
    ctl.tally({ kind: 'couldntCheck', cause: 'network' });
    ctl.syncNow();
    await flush();
    await flush();
    expect(report.mock.calls.filter(([e]) => e instanceof DatabaseTooNewError)).toHaveLength(1);
    ctl.stop();
  });

  it('retries the store open after a failure', async () => {
    const real = await setup();
    real.ctl.stop();
    let calls = 0;
    const { ctl } = await setup({
      db: () =>
        ++calls === 1 ? Promise.reject(new Error('open failed')) : Promise.resolve(real.stores),
    });
    await expect(ctl.decide(TICKET)).rejects.toThrow('open failed');
    await expect(ctl.decide(TICKET)).resolves.toBeDefined();
    ctl.stop();
  });

  it('tally counts an admitted outcome in the device store', async () => {
    const { ctl, stores } = await setup();
    ctl.tally({
      kind: 'admitted',
      ticketType: null,
      ticketIndex: null,
      totalTickets: null,
      checkedInCount: null,
      checkedInAt: null,
    });
    await flush();
    await flush();
    expect(await stores.device.tally()).toMatchObject({ admitted: 1, used: 0 });
  });

  it('tally never throws when the store fails', async () => {
    const report = jest.fn();
    const { ctl, stores } = await setup({ report });
    jest.spyOn(stores.device, 'addToTally').mockRejectedValue(new Error('disk'));
    expect(() => {
      ctl.tally({ kind: 'couldntCheck', cause: 'noOfflineList' });
    }).not.toThrow();
    await flush();
    expect(report).toHaveBeenCalled();
  });

  it('a lookup admission is synced at once and the status is refreshed', async () => {
    const { ctl, post, status } = await setup();
    ctl.start();
    await flush();
    await flush();
    post.mockClear();
    status.length = 0;
    const o = await ctl.admitFromLookup(T, null);
    expect(o).toMatchObject({ kind: 'admitted', offline: true, via: 'lookup' });
    for (let i = 0; i < 6; i++) await flush();
    expect(post).toHaveBeenCalled();
    expect(status.some((st) => typeof st.pending === 'number' && st.pending >= 0)).toBe(true);
    ctl.stop();
  });

  it('gate errors from an override reach the caller', async () => {
    const { ctl } = await setup({}, { override: KAT });
    ctl.start();
    await flush();
    await flush();
    await expect(ctl.override(TICKET, { approvedBy: 'Ada', reason: 'phone died' })).rejects.toThrow(
      'approval required',
    );
    ctl.stop();
  });

  it('refreshStatus publishes the override availability', async () => {
    const { ctl, status } = await setup({}, { override: KAT });
    ctl.start();
    await flush();
    await flush();
    expect(status).toContainEqual(
      expect.objectContaining({ override: { kind: 'open', triesLeft: 5 } }),
    );
    ctl.stop();
  });

  it('activity pages 50 rows and exportRows delegates to the outbox', async () => {
    const { ctl, stores } = await setup();
    const list = jest.spyOn(stores.outbox, 'list');
    const rows = jest.spyOn(stores.outbox, 'exportRows');
    await ctl.activity('toSync', null);
    await ctl.exportRows();
    expect(list).toHaveBeenCalledWith(EV, 'toSync', null, 50);
    expect(rows).toHaveBeenCalledWith(EV);
  });
});
