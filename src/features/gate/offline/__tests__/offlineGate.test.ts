import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';
import { memoryKv } from '@/shared/lib/kv';
import { createDeviceStore } from '@/features/gate/offline/deviceStore';
import { createOfflineGate } from '@/features/gate/offline/offlineGate';
import { createOutboxStore } from '@/features/gate/offline/outboxStore';
import { createRosterStore, type RosterRow } from '@/features/gate/offline/rosterStore';
import { MIGRATIONS } from '@/features/gate/offline/schema';
import { BH2_AT, BH2_ID, BH2_KEYS, BH2_TOKEN } from '@/features/gate/domain/__tests__/bh2Vector';

const EV = 'e0000000-0000-4000-8000-000000000001';
const BOOKING = 'b0000000-0000-4000-8000-000000000001';
const OTHER = '00000000-0000-4000-8000-000000000009';
const code = (raw: string): TicketCode => {
  const p = parseTicketCode(raw);
  if (!p) throw new Error('bad fixture');
  return p.value;
};
const row = (id: string, index: number): RosterRow => ({
  id,
  ticketType: 'Regular',
  ticketIndex: index,
  bookingId: BOOKING,
  bookingStatus: 'confirmed',
  checkedInAt: null,
  scannedBy: null,
  byMe: null,
  holderName: null,
  phoneMasked: null,
  seat: null,
});

async function setup(opts: { ready?: boolean } = {}) {
  const db = nodeSql();
  await migrate(db, MIGRATIONS);
  const roster = createRosterStore(db);
  const outbox = createOutboxStore(db, { newDeviceId: () => 'device-abcdef12' });
  await roster.beginSync(
    EV,
    'full',
    '2026-10-07T17:00:00Z',
    { title: null, eventDate: null, requireDynamic: false, total: 2 },
    BH2_KEYS,
  );
  await roster.writePage(EV, 'full', [row(BH2_ID, 1), row(OTHER, 2)], null);
  if (opts.ready !== false) await roster.finishSync(EV, 'full');
  const onKeysOutdated = jest.fn();
  const onAdmitted = jest.fn();
  const gate = createOfflineGate({
    eventId: EV,
    roster,
    outbox,
    device: createDeviceStore(db, { lockKv: memoryKv() }),
    serverNow: () => BH2_AT,
    clockState: () => ({ suspect: false, checkedAgoMs: 0 }),
    appVersion: '1.0.0 (7)',
    onKeysOutdated,
    onAdmitted,
  });
  return { roster, outbox, gate, onKeysOutdated, onAdmitted };
}

describe('offline gate', () => {
  it('admits a valid BH2, writing the outbox before answering', async () => {
    const { outbox, gate, onAdmitted } = await setup();
    const o = await gate.decide(code(BH2_TOKEN));
    expect(o).toEqual({
      kind: 'admitted',
      offline: true,
      ticketType: 'Regular',
      ticketIndex: 1,
      totalTickets: 2,
      checkedInCount: 1,
      checkedInAt: new Date(BH2_AT).toISOString(),
    });
    expect(await outbox.due(EV, 0, 10)).toEqual([
      expect.objectContaining({
        ticketId: BH2_ID,
        code: BH2_TOKEN,
        kid: 't',
        scannedAt: new Date(BH2_AT).toISOString(),
      }),
    ]);
    expect(onAdmitted).toHaveBeenCalledTimes(1);
  });

  it('a throwing onAdmitted or onKeysOutdated never changes the outcome', async () => {
    const { outbox, gate, roster, onAdmitted, onKeysOutdated } = await setup();
    onAdmitted.mockImplementation(() => {
      throw new Error('boom');
    });
    onKeysOutdated.mockImplementation(() => {
      throw new Error('boom');
    });
    expect((await gate.decide(code(BH2_TOKEN))).kind).toBe('admitted');
    expect(await outbox.due(EV, 0, 10)).toHaveLength(1);
    await roster.setKeys(EV, []);
    expect(await gate.decide(code(BH2_TOKEN))).toEqual({
      kind: 'couldntCheck',
      cause: 'keysOutdated',
    });
  });

  it('the same ticket as a printed code right after is already used by you', async () => {
    const { gate } = await setup();
    await gate.decide(code(BH2_TOKEN));
    expect(await gate.decide(code(BH2_ID))).toMatchObject({
      kind: 'used',
      scannedBy: { kind: 'me' },
    });
  });

  it('two presentations of one ticket at once admit exactly once', async () => {
    const { outbox, gate } = await setup();
    const [a, b] = await Promise.all([gate.decide(code(BH2_TOKEN)), gate.decide(code(BH2_ID))]);
    expect([a.kind, b.kind].sort()).toEqual(['admitted', 'used']);
    expect(await outbox.due(EV, 0, 10)).toHaveLength(1);
  });

  it('no finished list yet → couldnt check, nothing written', async () => {
    const { outbox, gate } = await setup({ ready: false });
    expect(await gate.decide(code(BH2_ID))).toEqual({
      kind: 'couldntCheck',
      cause: 'noOfflineList',
    });
    expect(await outbox.due(EV, 0, 10)).toEqual([]);
  });

  it('a full refresh in progress does not hide the current list', async () => {
    const { roster, gate } = await setup();
    await roster.beginSync(
      EV,
      'full',
      '2026-10-07T18:00:00Z',
      { title: null, eventDate: null, requireDynamic: false, total: 0 },
      null,
    );
    expect((await gate.decide(code(OTHER))).kind).toBe('admitted');
  });

  it('a booking code and an unknown ticket are refused differently', async () => {
    const { gate } = await setup();
    expect(await gate.decide(code(BOOKING))).toMatchObject({
      kind: 'refused',
      reason: 'oldFormat',
    });
    expect(await gate.decide(code('00000000-0000-4000-8000-0000000000ff'))).toMatchObject({
      kind: 'refused',
      reason: 'notInList',
      listUpdatedAt: Date.parse('2026-10-07T17:00:00Z'),
    });
  });

  it('an unknown key asks for a key refresh', async () => {
    const { roster, gate, onKeysOutdated } = await setup();
    await roster.setKeys(EV, []);
    expect(await gate.decide(code(BH2_TOKEN))).toEqual({
      kind: 'couldntCheck',
      cause: 'keysOutdated',
    });
    expect(onKeysOutdated).toHaveBeenCalled();
  });

  it('live answers teach the list', async () => {
    const { roster, gate } = await setup();
    await gate.noteLive(code(OTHER), {
      kind: 'used',
      checkedInAt: '2026-10-07T18:00:00Z',
      scannedBy: { kind: 'named', name: 'Ada' },
      ticketType: null,
      replayed: false,
    });
    expect(await roster.ticket(EV, OTHER)).toMatchObject({
      checkedInAt: '2026-10-07T18:00:00Z',
      scannedBy: 'Ada',
      byMe: false,
    });
  });
});
