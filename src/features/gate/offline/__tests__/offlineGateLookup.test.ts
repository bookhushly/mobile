import { memoryKv, type KeyValue } from '@/shared/lib/kv';
import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';
import { createDeviceStore } from '@/features/gate/offline/deviceStore';
import { createOfflineGate } from '@/features/gate/offline/offlineGate';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';

const EV = 'e0000000-0000-4000-8000-000000000001';
const A = '00000000-0000-4000-8000-000000000001';
const PENDING = '00000000-0000-4000-8000-000000000002';
const UNLISTED = '00000000-0000-4000-8000-0000000000ff';
const KAT = { enabled: true, alg: 'scrypt', N: 8192, r: 8, p: 1, dk_len: 32, salt: 'ABEiM0RVZneImaq7zN3u_w', hash: 'L8yIIos_9EAoJkqiN2s2Qv6pNMzKe65LM05K0fZtgeA' };
const NOW = Date.parse('2026-10-07T18:00:00Z');
const code = (raw: string): TicketCode => {
  const p = parseTicketCode(raw);
  if (!p) throw new Error('fixture');
  return p.value;
};
const row = (id: string, over: Partial<RosterRow> = {}): RosterRow => ({
  id, ticketType: 'VIP', ticketIndex: 1, bookingId: 'b', bookingStatus: 'confirmed', checkedInAt: null,
  scannedBy: null, byMe: null, holderName: 'Ada', phoneMasked: '0803••••210', seat: null, ...over,
});

async function setup(opts: { requireDynamic?: boolean; override?: unknown; lockKv?: KeyValue; failMeta?: boolean; clock?: { now: number } } = {}) {
  const lockKv = opts.lockKv ?? memoryKv();
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const base = createRosterStore(db);
  const roster = opts.failMeta === true ? { ...base, meta: (): Promise<never> => Promise.reject(new Error('db')) } : base;
  await base.beginSync(EV, 'full', '2026-10-07T17:00:00Z', { title: null, eventDate: null, requireDynamic: opts.requireDynamic ?? false, total: 2 }, [], opts.override === undefined ? KAT : opts.override);
  await base.writePage(EV, 'full', [row(A), row(PENDING, { bookingStatus: 'pending', ticketIndex: 2 })], null);
  await base.finishSync(EV, 'full');
  const outbox = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  const device = createDeviceStore(db, { now: () => NOW, lockKv });
  const gate = createOfflineGate({
    eventId: EV, roster, outbox, device, serverNow: () => opts.clock?.now ?? NOW,
    clockState: () => ({ suspect: false, checkedAgoMs: 0 }), appVersion: '1',
    onKeysOutdated: jest.fn(), onAdmitted: jest.fn(),
  });
  return { gate, outbox, device, lockKv };
}

describe('lookup and override', () => {
  it('admits from lookup as manual_lookup', async () => {
    const { gate, outbox } = await setup();
    expect(await gate.admitFromLookup(A, null)).toMatchObject({ kind: 'admitted', via: 'lookup' });
    expect((await outbox.due(EV, 0, 10))[0]).toMatchObject({ mode: 'manual_lookup', code: A });
    expect(await gate.admitFromLookup(A, null)).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });
  it('refuses an unconfirmed booking from lookup', async () => {
    const { gate } = await setup();
    expect(await gate.admitFromLookup(PENDING, null)).toEqual({ kind: 'refused', reason: 'notConfirmed', fixable: false });
  });
  it('a live-ticket event cannot admit from lookup without an approval', async () => {
    const { gate, outbox } = await setup({ requireDynamic: true });
    expect(await gate.needsPinForLookup()).toBe(true);
    await expect(gate.admitFromLookup(A, null)).rejects.toThrow('approval required');
    await expect(gate.admitFromLookup(A, { approvedBy: 'Tunde', reason: null })).rejects.toThrow('approval required');
    expect(await gate.checkPin('123456')).toEqual({ kind: 'ok' });
    expect(await gate.admitFromLookup(A, { approvedBy: 'Tunde', reason: null })).toMatchObject({ kind: 'admitted' });
    expect((await outbox.due(EV, 0, 10))[0]).toMatchObject({ mode: 'manual_lookup', approvedBy: 'Tunde' });
  }, 30_000);
  it('checks the PIN, counts failures and locks', async () => {
    const { gate } = await setup();
    expect(await gate.availability()).toEqual({ kind: 'open', triesLeft: 5 });
    expect(await gate.checkPin('000000')).toEqual({ kind: 'wrong', triesLeft: 4 });
    for (let i = 0; i < 3; i++) await gate.checkPin('000000');
    expect(await gate.checkPin('000000')).toEqual({ kind: 'locked', minutesLeft: 15 });
    expect(await gate.checkPin('123456')).toEqual({ kind: 'locked', minutesLeft: 15 });
  }, 30_000);
  it('a correct PIN resets the count', async () => {
    const { gate } = await setup();
    await gate.checkPin('000000');
    expect(await gate.checkPin('123456')).toEqual({ kind: 'ok' });
    expect(await gate.availability()).toEqual({ kind: 'open', triesLeft: 5 });
  }, 30_000);
  it('no usable verifier means no override', async () => {
    const { gate } = await setup({ override: null });
    expect(await gate.availability()).toEqual({ kind: 'none' });
    expect(await gate.checkPin('123456')).toEqual({ kind: 'unavailable' });
  });
  it('overrides an unlisted ticket once', async () => {
    const { gate, outbox } = await setup();
    const approval = { approvedBy: 'Tunde', reason: 'Bought at the door' };
    await gate.checkPin('123456');
    expect(await gate.override(code(UNLISTED), approval)).toMatchObject({ kind: 'admitted', via: 'override' });
    await gate.checkPin('123456');
    expect(await gate.override(code(UNLISTED), approval)).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
    const rows = await outbox.due(EV, 0, 10);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mode: 'offline_override', code: UNLISTED, approvedBy: 'Tunde', reason: 'Bought at the door' });
  }, 30_000);
  it('a lock that cannot be read counts as locked', async () => {
    const lockKv: KeyValue = { ...memoryKv(), get: () => Promise.reject(new Error('keychain')) };
    const { gate } = await setup({ lockKv });
    expect(await gate.availability()).toEqual({ kind: 'locked', minutesLeft: 15 });
    expect(await gate.checkPin('123456')).toEqual({ kind: 'locked', minutesLeft: 15 });
  });
  it('two parallel wrong PINs both count', async () => {
    const { gate, lockKv } = await setup();
    await Promise.all([gate.checkPin('000000'), gate.checkPin('000000')]);
    expect(JSON.parse((await lockKv.get('override_lock')) ?? '{}')).toMatchObject({ failures: 2 });
  }, 30_000);
  it('a correct PIN after four failures is ok and resets', async () => {
    const { gate } = await setup();
    for (let i = 0; i < 4; i++) await gate.checkPin('000000');
    expect(await gate.checkPin('123456')).toEqual({ kind: 'ok' });
    expect(await gate.availability()).toEqual({ kind: 'open', triesLeft: 5 });
  }, 30_000);
  it('fails closed when the count cannot be saved', async () => {
    const lockKv: KeyValue = { ...memoryKv(), set: () => Promise.reject(new Error('keychain')) };
    const { gate } = await setup({ lockKv });
    expect(await gate.checkPin('123456')).toEqual({ kind: 'unavailable' });
    await expect(gate.override(code(UNLISTED), { approvedBy: 'T', reason: 'abc' })).rejects.toThrow('approval required');
  });
  it('a roster read failure is unavailable, not a throw', async () => {
    const { gate } = await setup({ failMeta: true });
    expect(await gate.availability()).toEqual({ kind: 'none' });
    expect(await gate.checkPin('123456')).toEqual({ kind: 'unavailable' });
  });
  it('an override needs a fresh, single-use PIN grant', async () => {
    const t = { now: NOW };
    const { gate } = await setup({ clock: t });
    const a = { approvedBy: 'Tunde', reason: 'Bought at the door' };
    await expect(gate.override(code(UNLISTED), a)).rejects.toThrow('approval required');
    await gate.checkPin('123456');
    expect(await gate.override(code(UNLISTED), a)).toMatchObject({ kind: 'admitted' });
    await expect(gate.override(code('00000000-0000-4000-8000-0000000000fe'), a)).rejects.toThrow('approval required');
    await gate.checkPin('123456');
    t.now += 61_000;
    await expect(gate.override(code('00000000-0000-4000-8000-0000000000fe'), a)).rejects.toThrow('approval required');
  }, 30_000);
  it('an override needs a usable verifier', async () => {
    const { gate } = await setup({ override: null });
    await expect(gate.override(code(UNLISTED), { approvedBy: 'T', reason: 'abc' })).rejects.toThrow('approval required');
  });
  it('rejects a bad approval', async () => {
    const { gate } = await setup();
    await expect(gate.override(code(UNLISTED), { approvedBy: ' ', reason: 'abc' })).rejects.toThrow('invalid approval');
    await expect(gate.override(code(UNLISTED), { approvedBy: 'T', reason: 'ab' })).rejects.toThrow('invalid approval');
    await expect(gate.admitFromLookup(A, { approvedBy: 'T', reason: 'x'.repeat(201) })).rejects.toThrow('invalid approval');
  });
  it('refuses an override of a listed unconfirmed ticket without recording', async () => {
    const { gate, outbox } = await setup();
    await gate.checkPin('123456');
    expect(await gate.override(code(PENDING), { approvedBy: 'T', reason: 'abc' })).toEqual({ kind: 'refused', reason: 'notConfirmed', fixable: false });
    expect(await outbox.due(EV, 0, 10)).toHaveLength(0);
  }, 30_000);
  it('searches and lists a booking', async () => {
    const { gate } = await setup();
    expect((await gate.search({ kind: 'phoneTail', value: '210' })).length).toBe(2);
    expect((await gate.bookingTickets('b')).map((r) => r.ticketIndex)).toEqual([1, 2]);
  });
});
