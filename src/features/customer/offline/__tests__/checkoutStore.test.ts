import {
  checkoutStore,
  createCheckoutStore,
  type CheckoutEntry,
} from '@/features/customer/offline/checkoutStore';
import { memoryKv, type KeyValue } from '@/shared/lib/kv';
import { runAlwaysWipes } from '@/shared/lib/signOutGuard';

// No Node types in this project: read the file through Jest's own module loader.
const fs = jest.requireActual<{ readFileSync(path: string, enc: 'utf8'): string }>('fs');
const cwd = jest.requireActual<{ cwd(): string }>('process').cwd();

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
    const payment = {
      reference: 'ref1',
      paymentUrl: 'https://checkout.paystack.com/x',
      startedAt: NOW,
    };
    await store.setPayment('u1', 'hotel', 'b1', payment);
    expect(await store.get('u1', 'hotel', 'b1')).toEqual(
      entry({ payment, paymentEverStarted: true }),
    );
  });

  it('clearPayment keeps the entry and that a payment was started', async () => {
    const { store } = make();
    await store.put(entry());
    const payment = {
      reference: 'ref1',
      paymentUrl: 'https://checkout.paystack.com/x',
      startedAt: NOW,
    };
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

  it('clearPayment and drop with a reference skip an entry holding a newer payment (A4)', async () => {
    const { store } = make();
    const ref2 = {
      reference: 'ref2',
      paymentUrl: 'https://checkout.paystack.com/b',
      startedAt: NOW,
    };
    await store.put(entry({ payment: ref2, paymentEverStarted: true }));
    await store.clearPayment('u1', 'hotel', 'b1', 'ref1');
    await store.drop('u1', 'hotel', 'b1', 'ref1');
    expect((await store.get('u1', 'hotel', 'b1'))?.payment).toEqual(ref2);
    await store.clearPayment('u1', 'hotel', 'b1', 'ref2');
    expect((await store.get('u1', 'hotel', 'b1'))?.payment).toBeNull();
    // No payment left to protect: a settle for any reference may drop it.
    await store.drop('u1', 'hotel', 'b1', 'ref1');
    expect(await store.get('u1', 'hotel', 'b1')).toBeNull();
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
    expect(Object.keys(kv.dump())).toHaveLength(52); // 50 entries + the two indexes
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

  it('writes both indexes before the entry (B1)', async () => {
    const kv = memoryKv();
    const order: string[] = [];
    const spy: KeyValue = {
      get: (k) => kv.get(k),
      set: (k, v) => {
        order.push(k);
        return kv.set(k, v);
      },
      delete: (k) => kv.delete(k),
    };
    await createCheckoutStore(spy, () => NOW).put(entry());
    expect(order).toEqual(['bh.checkout-keys', 'bh.checkout-index', 'bh.checkout.u1.hotel.b1']);
  });

  it('wipe finds an entry the main index lost (corrupt index) (B1)', async () => {
    const { store, kv } = make();
    await store.put(entry());
    await kv.set('bh.checkout-index', 'garbage');
    await store.wipe();
    expect(kv.dump()).toEqual({});
  });

  it('wipe finds an entry whose eviction was cut short (B1)', async () => {
    const kv = memoryKv();
    let failNext = false;
    const flaky: KeyValue = {
      get: (k) => kv.get(k),
      set: (k, v) => kv.set(k, v),
      delete: (k) => {
        if (failNext && k.endsWith('.b0')) {
          failNext = false;
          return Promise.reject(new Error('killed'));
        }
        return kv.delete(k);
      },
    };
    const store = createCheckoutStore(flaky, () => NOW);
    for (let i = 0; i < 50; i++) await store.put(entry({ bookingId: `b${String(i)}` }));
    failNext = true;
    await expect(store.put(entry({ bookingId: 'b50' }))).rejects.toThrow('killed');
    // b0 left the main index but is still on disk: wipe still finds it.
    expect(Object.keys(kv.dump())).toContain('bh.checkout.u1.hotel.b0');
    await store.wipe();
    expect(kv.dump()).toEqual({});
  });

  it('a write whose work began before a wipe is dropped (B1)', async () => {
    const { store, kv } = make();
    await store.put(entry({ bookingId: 'b2' }));
    const gen = store.generation();
    await store.wipe();
    await store.put(entry(), gen);
    await store.setPayment(
      'u1',
      'hotel',
      'b2',
      { reference: 'r', paymentUrl: 'https://checkout.paystack.com/x', startedAt: NOW },
      gen,
    );
    await store.markStarted('u1', 'hotel', 'b1', gen);
    expect(kv.dump()).toEqual({});
    // Work begun after the wipe writes as usual.
    await store.put(entry(), store.generation());
    expect(await store.get('u1', 'hotel', 'b1')).toEqual(entry());
  });

  it('setPayment stores a URL off the Paystack allowlist as no URL, keeping the reference (B3)', async () => {
    const { store } = make();
    await store.put(entry());
    await store.setPayment('u1', 'hotel', 'b1', {
      reference: 'ref1',
      paymentUrl: 'https://evil.test/pay',
      startedAt: NOW,
    });
    expect((await store.get('u1', 'hotel', 'b1'))?.payment).toEqual({
      reference: 'ref1',
      paymentUrl: '',
      startedAt: NOW,
    });
  });

  it('the root layout imports the store, so its sign-out wipe is always registered (B1)', () => {
    const root = fs.readFileSync(`${cwd}/src/app/_layout.tsx`, 'utf8');
    expect(root).toContain("import '@/features/customer/offline/checkoutStore';");
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
