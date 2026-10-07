import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { createOfflineController, type ControllerDeps } from '@/features/gate/offline/controller';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import type { SyncStatus } from '@/features/gate/domain/syncLine';
import { createConnectivity } from '@/shared/lib/connectivity';
import { ok } from '@/shared/lib/result';

const EV = 'e0000000-0000-4000-8000-000000000001';
const T = '00000000-0000-4000-8000-000000000001';
const flush = () => new Promise<void>((r) => setImmediate(r));
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

async function setup(over: Partial<ControllerDeps> = {}) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const stores = {
    roster: createRosterStore(db),
    outbox: createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' }),
    close: () => Promise.resolve(),
  };
  const status: Partial<SyncStatus>[] = [];
  const connectivity = createConnectivity();
  const fetchPage = jest.fn(() => Promise.resolve(ok(page)));
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

  it('an offline admission is synced when the server is back', async () => {
    const { ctl, post, connectivity } = await setup();
    ctl.start();
    await flush();
    await flush();
    connectivity.networkLost();
    const o = await ctl.decide(T as never);
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

  it('retries the store open after a failure', async () => {
    const real = await setup();
    real.ctl.stop();
    let calls = 0;
    const { ctl } = await setup({
      db: () =>
        ++calls === 1 ? Promise.reject(new Error('open failed')) : Promise.resolve(real.stores),
    });
    await expect(ctl.decide(T as never)).rejects.toThrow('open failed');
    await expect(ctl.decide(T as never)).resolves.toBeDefined();
    ctl.stop();
  });
});
