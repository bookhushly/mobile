import {
  checkoutStore,
  createCheckoutStore,
  type CheckoutEntry,
} from '@/features/customer/offline/checkoutStore';
import { memoryKv } from '@/shared/lib/kv';
import { runAlwaysWipes } from '@/shared/lib/signOutGuard';

jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));

const NOW = Date.parse('2026-10-21T12:00:00Z');
const hoursAgo = (h: number) => new Date(NOW - h * 3600_000).toISOString();

function entry(over: Partial<CheckoutEntry> = {}): CheckoutEntry {
  return {
    userId: 'u1',
    kind: 'hotel',
    bookingId: 'b1',
    listingId: 'l1',
    title: 'Sea View',
    createdAt: hoursAgo(1),
    total: 50000,
    pricing: { nights: 2, subtotal: 50000, discount: null },
    summary: { checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2 },
    guestEmail: 'a@b.co',
    payment: null,
    paymentEverStarted: false,
    ...over,
  };
}

const make = () => {
  const kv = memoryKv();
  return { kv, store: createCheckoutStore(kv, () => NOW) };
};

describe('checkout store', () => {
  it('round-trips an entry', async () => {
    const { store } = make();
    await store.put(entry());
    expect(await store.get('u1', 'hotel', 'b1')).toEqual(entry());
    expect(await store.get('u1', 'hotel', 'nope')).toBeNull();
  });

  it('setPayment keeps the pricing and everything else', async () => {
    const { store } = make();
    await store.put(entry());
    const payment = { reference: 'ref1', paymentUrl: 'https://pay.test/x', startedAt: NOW };
    await store.setPayment('u1', 'hotel', 'b1', payment);
    expect(await store.get('u1', 'hotel', 'b1')).toEqual(
      entry({ payment, paymentEverStarted: true }),
    );
  });

  it('clearPayment keeps the entry and that a payment was started', async () => {
    const { store } = make();
    await store.put(entry());
    const payment = { reference: 'ref1', paymentUrl: 'https://pay.test/x', startedAt: NOW };
    await store.setPayment('u1', 'hotel', 'b1', payment);
    await store.clearPayment('u1', 'hotel', 'b1');
    expect(await store.get('u1', 'hotel', 'b1')).toEqual(
      entry({ payment: null, paymentEverStarted: true }),
    );
  });

  it('markStarted sets the flag only', async () => {
    const { store } = make();
    await store.put(entry());
    await store.markStarted('u1', 'hotel', 'b1');
    expect(await store.get('u1', 'hotel', 'b1')).toEqual(entry({ paymentEverStarted: true }));
  });

  it('reads an entry saved before the started flag existed as not started', async () => {
    const { store, kv } = make();
    await store.put(entry());
    const key = 'bh.checkout.u1.hotel.b1';
    const { paymentEverStarted: _, ...old } = entry();
    await kv.set(key, JSON.stringify(old));
    expect(await store.get('u1', 'hotel', 'b1')).toEqual(entry());
  });

  it('clearPayment and markStarted on a missing entry create nothing', async () => {
    const { store, kv } = make();
    await store.clearPayment('u1', 'hotel', 'b1');
    await store.markStarted('u1', 'hotel', 'b1');
    expect(kv.dump()).toEqual({});
  });

  it('setPayment on a missing entry creates nothing', async () => {
    const { store, kv } = make();
    await store.setPayment('u1', 'hotel', 'b1', { reference: 'r', paymentUrl: 'u', startedAt: 1 });
    expect(kv.dump()).toEqual({});
  });

  it('drop removes the entry and its index key', async () => {
    const { store } = make();
    await store.put(entry());
    await store.drop('u1', 'hotel', 'b1');
    expect(await store.get('u1', 'hotel', 'b1')).toBeNull();
    expect(await store.list('u1')).toEqual([]);
  });

  it('list drops and deletes a 25-hour-old entry, keeps a fresh one', async () => {
    const { store, kv } = make();
    await store.put(entry({ bookingId: 'old', createdAt: hoursAgo(25) }));
    await store.put(entry({ bookingId: 'new', createdAt: hoursAgo(2) }));
    expect((await store.list('u1')).map((e) => e.bookingId)).toEqual(['new']);
    expect(Object.keys(kv.dump()).some((k) => k.endsWith('.old'))).toBe(false);
  });

  it('the 51st put evicts the oldest', async () => {
    const { store, kv } = make();
    for (let i = 0; i < 51; i++) await store.put(entry({ bookingId: `b${String(i)}` }));
    expect(await store.get('u1', 'hotel', 'b0')).toBeNull();
    expect(await store.get('u1', 'hotel', 'b1')).not.toBeNull();
    expect(await store.get('u1', 'hotel', 'b50')).not.toBeNull();
    expect(Object.keys(kv.dump())).toHaveLength(51); // 50 entries + the index
  });

  it('wipe empties every user', async () => {
    const { store, kv } = make();
    await store.put(entry());
    await store.put(entry({ userId: 'u2' }));
    await store.wipe();
    expect(kv.dump()).toEqual({});
  });

  it("another user's entries are invisible", async () => {
    const { store } = make();
    await store.put(entry({ userId: 'u2' }));
    expect(await store.list('u1')).toEqual([]);
    expect(await store.get('u1', 'hotel', 'b1')).toBeNull();
    expect(await store.list('u2')).toHaveLength(1);
  });

  it('a corrupt value reads as null and is cleaned by list', async () => {
    const { store, kv } = make();
    await store.put(entry());
    const key = 'bh.checkout.u1.hotel.b1';
    await kv.set(key, '{not json');
    expect(await store.get('u1', 'hotel', 'b1')).toBeNull();
    expect(await store.list('u1')).toEqual([]);
  });

  it('a corrupt index reads as empty', async () => {
    const { store, kv } = make();
    await kv.set('bh.checkout-index', 'garbage');
    expect(await store.list('u1')).toEqual([]);
  });

  it('put resolves only after the write', async () => {
    const { store, kv } = make();
    await store.put(entry());
    expect(Object.keys(kv.dump())).toContain('bh.checkout.u1.hotel.b1');
  });

  it('the exported store wipes on sign-out', async () => {
    await checkoutStore.put(entry());
    await runAlwaysWipes();
    expect(await checkoutStore.get('u1', 'hotel', 'b1')).toBeNull();
  });
});
