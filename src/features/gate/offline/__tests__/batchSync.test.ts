import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import type { BatchItem } from '@/features/gate/api/batch';
import { syncOutbox, type PostBatch } from '@/features/gate/offline/batchSync';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const EV = 'e0000000-0000-4000-8000-000000000001';
const id = (n: number) => `00000000-0000-4000-8000-00000000000${String(n)}`;
const row = (n: number): RosterRow => ({
  id: id(n), ticketType: 'Regular', ticketIndex: n, bookingId: 'b0000000-0000-4000-8000-000000000001',
  bookingStatus: 'confirmed', checkedInAt: null, scannedBy: null, byMe: null, holderName: null, phoneMasked: null, seat: null,
});

async function setup(n: number) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  await roster.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: false, total: n }, []);
  await roster.writePage(EV, 'full', Array.from({ length: n }, (_, i) => row(i + 1)), null);
  await roster.finishSync(EV, 'full');
  const store = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  for (let i = 1; i <= n; i++) {
    await store.recordAdmission({ eventId: EV, ticketId: id(i), code: id(i), scannedAt: '2026-10-07T18:00:00.000Z', kid: null, appVersion: '1' });
  }
  const sent: BatchItem[][] = [];
  const deps = (post: PostBatch) => ({
    store, eventId: EV, now: () => 1_000, random: () => 1, report: jest.fn(), batchSize: 2,
    post: (d: string, items: BatchItem[]) => { sent.push(items); return post(d, items); },
  });
  return { store, sent, deps };
}

const echo = (code = 'ok'): PostBatch => (_d, items) =>
  Promise.resolve(ok({ results: items.map((i) => ({ client_seq: i.client_seq, ok: code === 'ok', code })) }));

describe('syncOutbox', () => {
  it('sends in order in batches and settles every item', async () => {
    const { store, sent, deps } = await setup(3);
    expect(await syncOutbox(deps(echo()))).toBe('idle');
    expect(sent.map((b) => b.map((i) => i.client_seq))).toEqual([[1, 2], [3]]);
    expect(sent[0]?.[0]).toEqual({ client_seq: 1, ticket_id: id(1), scanned_at: '2026-10-07T18:00:00.000Z', mode: 'offline' });
    expect(await store.status(EV)).toMatchObject({ pending: 0, attention: 0 });
  });

  it('posts the override mode, reason and approver, and omits them for a plain item', async () => {
    const { store, sent, deps } = await setup(1);
    await store.recordOverride({
      eventId: EV, ticketId: id(9), scannedAt: '2026-10-07T18:00:00.000Z', appVersion: '1',
      approval: { approvedBy: 'Tunde', reason: 'Bought at the door' },
    });
    await syncOutbox(deps(echo()));
    const items = sent.flat();
    expect(items[1]).toMatchObject({ mode: 'offline_override', reason: 'Bought at the door', approved_by: 'Tunde' });
    expect(Object.keys(items[0] ?? {})).not.toContain('reason');
    expect(Object.keys(items[0] ?? {})).not.toContain('approved_by');
  });

  it.each<[ApiError]>([[{ kind: 'network' }], [{ kind: 'timeout' }], [{ kind: 'unavailable', status: 503 }], [{ kind: 'rateLimited' }], [{ kind: 'auth' }], [{ kind: 'validation' }]])(
    'a transient %j keeps the items and backs off',
    async (e) => {
      const { store, deps } = await setup(1);
      expect(await syncOutbox(deps(() => Promise.resolve(err(e))))).toBe('retryLater');
      expect(await store.due(EV, 1_000, 10)).toEqual([]);
      expect((await store.due(EV, 1_000 + 2_000, 10))[0]).toMatchObject({ seq: 1, attempts: 1 });
    },
  );

  it('a whole-request 403 blocks the event', async () => {
    const { store, deps } = await setup(2);
    expect(await syncOutbox(deps(() => Promise.resolve(err({ kind: 'forbidden', code: 'forbidden' }))))).toBe('blocked');
    expect(await store.status(EV)).toMatchObject({ pending: 0, blocked: true });
  });

  it('a 400 parks the items as errors and reports, without looping', async () => {
    const { store, deps } = await setup(1);
    const d = deps(() => Promise.resolve(err({ kind: 'unknown', status: 400, code: 'bad_request' })));
    expect(await syncOutbox(d)).toBe('error');
    expect(d.report).toHaveBeenCalled();
    expect(await store.status(EV)).toMatchObject({ pending: 0, attention: 1 });
  });

  it('a post that throws returns the items to pending and reports', async () => {
    const { store, deps } = await setup(1);
    const d = deps(() => Promise.reject(new Error('boom')));
    expect(await syncOutbox(d)).toBe('retryLater');
    expect(d.report).toHaveBeenCalled();
    expect(await store.status(EV)).toMatchObject({ pending: 1 });
    expect((await store.due(EV, 1_000 + 2_000, 10))[0]).toMatchObject({ seq: 1, state: 'pending', attempts: 1 });
  });

  it('a device id failure leaves the items pending, never stuck sending', async () => {
    const { store, deps } = await setup(1);
    jest.spyOn(store, 'deviceId').mockRejectedValueOnce(new Error('db'));
    await expect(syncOutbox(deps(echo()))).rejects.toThrow('db');
    expect((await store.due(EV, 1_000, 10))[0]).toMatchObject({ seq: 1, state: 'pending' });
  });

  it('an item missing from the response stays queued', async () => {
    const { store, deps } = await setup(2);
    const partial: PostBatch = () => Promise.resolve(ok({ results: [{ client_seq: 1, ok: true, code: 'ok' }] }));
    expect(await syncOutbox(deps(partial))).toBe('retryLater');
    expect(await store.status(EV)).toMatchObject({ pending: 1 });
  });

  it('duplicates are kept for attention', async () => {
    const { store, deps } = await setup(1);
    const dup: PostBatch = () =>
      Promise.resolve(ok({ results: [{ client_seq: 1, ok: false, code: 'already_checked_in', by_me: false, scanned_by: 'Ada', checked_in_at: 't' }] }));
    await syncOutbox(deps(dup));
    expect(await store.attention(EV)).toEqual([expect.objectContaining({ state: 'duplicate' })]);
  });
});
