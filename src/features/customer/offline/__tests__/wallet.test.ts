import { createWallet, wallet, type WalletEntry } from '@/features/customer/offline/wallet';
import type { MyBooking } from '@/features/customer/domain/myBookings';
import { runAlwaysWipes } from '@/shared/lib/signOutGuard';

// The default instance binds native storage; back it with memory instead.
jest.mock('@/shared/platform/secureStore', () => ({
  secureKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));
jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));

// 2026-10-13 12:00 Lagos (11:00 UTC).
const NOW = Date.UTC(2026, 9, 13, 11, 0, 0);

function store() {
  const m = new Map<string, string>();
  return {
    m,
    getItem: (k: string) => Promise.resolve(m.get(k) ?? null),
    setItem: (k: string, v: string) => {
      m.set(k, v);
      return Promise.resolve();
    },
    removeItem: (k: string) => {
      m.delete(k);
      return Promise.resolve();
    },
  };
}

function booking(over: Partial<MyBooking> = {}): MyBooking {
  return {
    kind: 'event',
    id: 'e1',
    title: 'Afrobeats night',
    place: 'Eko Hotel',
    start: '2026-10-18',
    end: '2026-10-18',
    time: '19:00',
    status: 'Confirmed',
    tone: 'success',
    paid: true,
    pending: false,
    when: 'upcoming',
    next: 'Sat 18 Oct · 7:00 pm',
    imageUrl: null,
    createdAt: '2026-10-01T10:00:00Z',
    ...over,
  };
}

const ticketed: WalletEntry = {
  ...booking(),
  liveOnly: false,
  tickets: [
    { id: 't1', index: 1, total: 2, type: 'VIP', seat: 'A1', admittedAt: null },
    { id: 't2', index: 2, total: 2, type: 'VIP', seat: null, admittedAt: null },
  ],
};
const stay: WalletEntry = {
  ...booking({ kind: 'hotel', id: 'h1', start: '2026-10-12', end: '2026-10-14', when: 'today' }),
  checkInCode: 'ABCD1234',
};

it('round-trips the entries for the same user', async () => {
  const w = createWallet({ store: store() });
  await w.save('u1', [ticketed, stay], NOW);
  expect(await w.load('u1')).toEqual({ userId: 'u1', savedAt: NOW, entries: [stay, ticketed] });
});

it('keeps a booking whose created_at is missing', async () => {
  const w = createWallet({ store: store() });
  const undated = booking({ createdAt: null });
  await w.save('u1', [undated], NOW);
  expect((await w.load('u1'))?.entries).toEqual([undated]);
});

it('another user, nothing saved, or bad JSON load as null', async () => {
  const s = store();
  const w = createWallet({ store: s });
  expect(await w.load('u1')).toBeNull();
  await w.save('u1', [ticketed], NOW);
  expect(await w.load('u2')).toBeNull();
  for (const bad of [
    'not json',
    '{"userId":"u1"}',
    JSON.stringify({ userId: 'u1', savedAt: 1, entries: [{ id: 1 }] }),
  ]) {
    s.m.set([...s.m.keys()][0] ?? '', bad);
    expect(await w.load('u1')).toBeNull();
  }
});

it('keeps only today and upcoming entries', async () => {
  const w = createWallet({ store: store() });
  const past = booking({ id: 'old', start: '2026-10-10', end: '2026-10-10', when: 'past' });
  // Marked upcoming when listed, but over by the time it is saved.
  const stale = booking({ id: 'stale', start: '2026-10-12', end: '2026-10-12', when: 'upcoming' });
  await w.save('u1', [past, stale, ticketed], NOW);
  expect((await w.load('u1'))?.entries.map((e) => e.id)).toEqual(['e1']);
});

it('keeps at most 30 entries, soonest first', async () => {
  const w = createWallet({ store: store() });
  const day = (i: number) =>
    new Date(Date.UTC(2026, 10, 1) + i * 86_400_000).toISOString().slice(0, 10);
  // Latest first, so the cap must sort before cutting.
  const many = Array.from({ length: 40 }, (_, i) =>
    booking({ id: `e${String(i)}`, start: day(39 - i), end: day(39 - i) }),
  );
  await w.save('u1', many, NOW);
  const entries = (await w.load('u1'))?.entries ?? [];
  expect(entries).toHaveLength(30);
  expect(entries[0]?.start).toBe('2026-11-01');
  expect(entries[29]?.start).toBe(day(29));
});

it('never stores email, phone or amounts', async () => {
  const s = store();
  const w = createWallet({ store: s });
  const leaky = {
    ...ticketed,
    email: 'ada@example.com',
    phone: '+2348031234567',
    amount: 5000,
    total_amount: 5000,
  };
  await w.save('u1', [leaky], NOW);
  const raw = [...s.m.values()].join('');
  for (const key of ['email', 'phone', 'amount', 'ada@example.com']) {
    expect(raw).not.toContain(key);
  }
  const entry = (await w.load('u1'))?.entries[0] ?? {};
  for (const key of ['email', 'phone', 'amount', 'total_amount'])
    expect(entry).not.toHaveProperty(key);
});

it('keeps at most 20 tickets per entry', async () => {
  const w = createWallet({ store: store() });
  const tickets = Array.from({ length: 25 }, (_, i) => ({
    id: `t${String(i)}`,
    index: i + 1,
    total: 25,
    type: 'Regular',
    seat: null,
    admittedAt: null,
  }));
  await w.save('u1', [{ ...booking(), tickets }], NOW);
  const kept = (await w.load('u1'))?.entries[0]?.tickets ?? [];
  expect(kept).toHaveLength(20);
  expect(kept[0]?.id).toBe('t0');
});

describe('skips a write that would change nothing', () => {
  function counting() {
    const s = store();
    const setItem = jest.fn(s.setItem);
    return { s: { ...s, setItem }, setItem };
  }

  it('the same entries again (a later refresh) are not rewritten', async () => {
    const { s, setItem } = counting();
    const w = createWallet({ store: s });
    await w.save('u1', [ticketed, stay], NOW);
    await w.save('u1', [stay, ticketed], NOW + 60_000);
    expect(setItem).toHaveBeenCalledTimes(1);
  });

  it('a change, another user, or a save after a wipe writes', async () => {
    const { s, setItem } = counting();
    const w = createWallet({ store: s });
    await w.save('u1', [ticketed], NOW);
    await w.save('u1', [ticketed, stay], NOW);
    expect(setItem).toHaveBeenCalledTimes(2);
    await w.save('u2', [ticketed, stay], NOW);
    expect(setItem).toHaveBeenCalledTimes(3);
    await w.wipe();
    await w.save('u2', [ticketed, stay], NOW);
    expect(setItem).toHaveBeenCalledTimes(4);
    expect((await w.load('u2'))?.entries).toEqual([stay, ticketed]);
  });

  it('a failed write is retried by the next save', async () => {
    const { s, setItem } = counting();
    setItem.mockRejectedValueOnce(new Error('disk full'));
    const w = createWallet({ store: s });
    await expect(w.save('u1', [ticketed], NOW)).rejects.toThrow('disk full');
    await w.save('u1', [ticketed], NOW);
    expect(setItem).toHaveBeenCalledTimes(2);
    expect((await w.load('u1'))?.entries).toEqual([ticketed]);
  });
});

it('invalid entries never take a slot under the cap', async () => {
  const w = createWallet({ store: store() });
  const day = (i: number) =>
    new Date(Date.UTC(2026, 10, 1) + i * 86_400_000).toISOString().slice(0, 10);
  const bad = { ...booking({ id: 'bad', start: day(0), end: day(0) }), tone: 'nope' };
  const many = Array.from({ length: 30 }, (_, i) =>
    booking({ id: `e${String(i)}`, start: day(i + 1), end: day(i + 1) }),
  );
  // A malformed entry (an older shape) is dropped and the next valid one takes its place.
  await w.save('u1', [bad as unknown as WalletEntry, ...many], NOW);
  const ids = (await w.load('u1'))?.entries.map((e) => e.id) ?? [];
  expect(ids).toHaveLength(30);
  expect(ids).not.toContain('bad');
});

it('wipe removes the wallet', async () => {
  const w = createWallet({ store: store() });
  await w.save('u1', [ticketed], NOW);
  await w.wipe();
  expect(await w.load('u1')).toBeNull();
});

describe('save and wipe run one at a time', () => {
  // Writes land only when released, like a slow encrypted write.
  function slowStore() {
    const s = store();
    const pending: (() => void)[] = [];
    const setItem = jest.fn(
      (k: string, v: string) =>
        new Promise<void>((resolve) => {
          pending.push(() => {
            s.m.set(k, v);
            resolve();
          });
        }),
    );
    const settle = async (release: boolean) => {
      for (let i = 0; i < 20; i++) {
        await Promise.resolve();
        if (release) for (const r of pending.splice(0)) r();
      }
    };
    return { store: { ...s, setItem }, setItem, pending, settle };
  }

  it('a save called before a wipe is dropped', async () => {
    const slow = slowStore();
    const w = createWallet({ store: slow.store });
    const saved = w.save('u1', [ticketed], NOW);
    const wiped = w.wipe();
    await slow.settle(true);
    await Promise.all([saved, wiped]);
    expect(slow.setItem).not.toHaveBeenCalled();
    expect(await w.load('u1')).toBeNull();
  });

  it('data loaded before a wipe is never written after it', async () => {
    const w = createWallet({ store: store() });
    const gen = w.generation();
    await w.wipe();
    await w.save('u1', [ticketed], NOW, gen);
    expect(await w.load('u1')).toBeNull();
    // Loaded after the wipe: saved.
    await w.save('u1', [ticketed], NOW, w.generation());
    expect(await w.load('u1')).not.toBeNull();
  });

  it('a write already under way finishes before the wipe removes it', async () => {
    const slow = slowStore();
    const w = createWallet({ store: slow.store });
    const first = w.save('u1', [ticketed], NOW);
    await slow.settle(false);
    expect(slow.pending).toHaveLength(1);
    const second = w.save('u1', [stay], NOW);
    const wiped = w.wipe();
    await slow.settle(true);
    await Promise.all([first, second, wiped]);
    expect(slow.setItem).toHaveBeenCalledTimes(1);
    expect(await w.load('u1')).toBeNull();

    // A save after the wipe works as usual.
    const third = w.save('u1', [stay], NOW);
    await slow.settle(true);
    await third;
    expect(await w.load('u1')).not.toBeNull();
  });
});

it('the default wallet is encrypted and registered to be wiped on every sign-out', async () => {
  await wallet.save('u1', [ticketed], NOW);
  expect(await wallet.load('u1')).not.toBeNull();
  await runAlwaysWipes();
  expect(await wallet.load('u1')).toBeNull();
});
