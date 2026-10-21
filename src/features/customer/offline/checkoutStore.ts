import { z } from 'zod';

import { isPaymentUrl } from '@/features/customer/domain/checkout/paymentFlow';
import type { KeyValue } from '@/shared/lib/kv';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';
import { plainKv } from '@/shared/platform/storage';

// Spec P5: a booking made but not yet paid survives an app kill, so the customer can resume it.
// Per user, wiped on every sign-out. Callers await put/setPayment BEFORE opening the browser.
//
// Privacy (B1): the key-value store can't list keys, so two indexes name every entry that may be
// on disk. Each is written before the entry and pruned only after it is deleted, so a kill in
// between leaves at worst an index key with no entry (harmless: it reads as null), never an entry
// a wipe can't find. `wipe()` deletes every key either index names, then both indexes.

export const CHECKOUT_PREFIX = 'bh.checkout.';
export const CHECKOUT_INDEX = 'bh.checkout-index';
/** Every entry key that may be on disk, including ones evicted or removed mid-way (B1). */
export const CHECKOUT_KEYS = 'bh.checkout-keys';
/** Oldest entries drop beyond this. */
export const CHECKOUT_MAX = 50;
/** An unpaid booking older than this is gone (listed entries are deleted). */
export const CHECKOUT_TTL_MS = 24 * 60 * 60 * 1000;

const entrySchema = z.object({
  userId: z.string(),
  kind: z.enum(['hotel', 'apartment', 'event']),
  bookingId: z.string(),
  listingId: z.string(),
  title: z.string(),
  createdAt: z.string(),
  total: z.number(),
  pricing: z.record(z.string(), z.number().nullable()).nullable(),
  summary: z.object({
    checkIn: z.string().optional(),
    checkOut: z.string().optional(),
    guests: z.number().optional(),
    roomName: z.string().optional(),
    eventDate: z.string().optional(),
    tickets: z.number().optional(),
  }),
  guestEmail: z.string(),
  payment: z
    .object({ reference: z.string(), paymentUrl: z.string(), startedAt: z.number() })
    .nullable(),
  // Ruling R8: a payment was (or may have been) started for this booking, ever. Survives
  // clearPayment, so leaving Review never cancels a booking that could be paid (P7).
  paymentEverStarted: z.boolean().default(false),
});

export type CheckoutEntry = z.infer<typeof entrySchema>;
export type CheckoutKind = CheckoutEntry['kind'];
export type CheckoutPayment = NonNullable<CheckoutEntry['payment']>;

const keys = z.array(z.string());

function parseJson(raw: string | null): unknown {
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createCheckoutStore(kv: KeyValue, now: () => number = Date.now) {
  // One operation at a time, in call order: a wipe is never overtaken by a put queued before it.
  // `generation` moves on every wipe: a write whose work began under an older one is dropped
  // (callers capture it before their async work, as the wallet does).
  let queue: Promise<unknown> = Promise.resolve();
  let generation = 0;
  const enqueue = <T>(op: () => Promise<T>): Promise<T> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };

  const keyOf = (userId: string, kind: CheckoutKind, bookingId: string) =>
    `${CHECKOUT_PREFIX}${userId}.${kind}.${bookingId}`;

  const readKeys = async (name: string): Promise<string[]> => {
    const p = keys.safeParse(parseJson(await kv.get(name)));
    return p.success ? p.data : [];
  };
  const readIndex = () => readKeys(CHECKOUT_INDEX);

  /** Before an entry is written: its key is in the all-keys index. */
  const track = async (key: string): Promise<void> => {
    const all = await readKeys(CHECKOUT_KEYS);
    if (!all.includes(key)) await kv.set(CHECKOUT_KEYS, JSON.stringify([...all, key]));
  };
  /** After entries are deleted: their keys leave the all-keys index. */
  const untrack = async (gone: readonly string[]): Promise<void> => {
    if (gone.length === 0) return;
    const all = await readKeys(CHECKOUT_KEYS);
    const kept = all.filter((k) => !gone.includes(k));
    if (kept.length !== all.length) await kv.set(CHECKOUT_KEYS, JSON.stringify(kept));
  };

  const read = async (key: string): Promise<CheckoutEntry | null> => {
    const p = entrySchema.safeParse(parseJson(await kv.get(key)));
    return p.success ? p.data : null;
  };

  const removeKey = async (key: string): Promise<void> => {
    await kv.delete(key);
    const index = await readIndex();
    if (index.includes(key)) {
      await kv.set(CHECKOUT_INDEX, JSON.stringify(index.filter((k) => k !== key)));
    }
    await untrack([key]);
  };

  /**
   * A settle for `expected` applies only while the entry still holds that reference (or none): a
   * newer payment written meanwhile is never cleared by an older one's answer (R8, A4).
   */
  const holds = (e: CheckoutEntry, expected: string | undefined) =>
    expected === undefined || e.payment === null || e.payment.reference === expected;

  const update = (
    userId: string,
    kind: CheckoutKind,
    bookingId: string,
    change: (e: CheckoutEntry) => CheckoutEntry,
    opts: { expected?: string; gen?: number } = {},
  ): Promise<void> => {
    const gen = opts.gen ?? generation;
    return enqueue(async () => {
      if (gen !== generation) return;
      const key = keyOf(userId, kind, bookingId);
      const entry = await read(key);
      if (!entry || !holds(entry, opts.expected)) return;
      await track(key);
      await kv.set(key, JSON.stringify(change(entry)));
    });
  };

  return {
    /** Bumped by every wipe; capture it when the work that will write starts. */
    generation(): number {
      return generation;
    },
    /**
     * Resolves only after the write is on disk. `gen`: the generation the work began under
     * (default: now); a wipe since then drops the write.
     */
    put(e: CheckoutEntry, gen = generation): Promise<void> {
      return enqueue(async () => {
        if (gen !== generation) return;
        const key = keyOf(e.userId, e.kind, e.bookingId);
        // Both indexes first: an entry on disk is always findable by wipe().
        await track(key);
        const index = [...(await readIndex()).filter((k) => k !== key), key];
        const evicted = index.slice(0, Math.max(0, index.length - CHECKOUT_MAX));
        await kv.set(CHECKOUT_INDEX, JSON.stringify(index.slice(evicted.length)));
        await kv.set(key, JSON.stringify(e));
        await Promise.all(evicted.map((k) => kv.delete(k)));
        await untrack(evicted);
      });
    },
    get(userId: string, kind: CheckoutKind, bookingId: string): Promise<CheckoutEntry | null> {
      return enqueue(() => read(keyOf(userId, kind, bookingId)));
    },
    /**
     * Resolves only after the write; a missing entry is left missing. Marks it started. A URL off
     * the Paystack allowlist is stored as '' (no URL: never reopened), the reference kept (B3).
     */
    setPayment(
      userId: string,
      kind: CheckoutKind,
      bookingId: string,
      payment: CheckoutPayment,
      gen?: number,
    ): Promise<void> {
      const safe = isPaymentUrl(payment.paymentUrl) ? payment : { ...payment, paymentUrl: '' };
      return update(
        userId,
        kind,
        bookingId,
        (e) => ({ ...e, payment: safe, paymentEverStarted: true }),
        gen === undefined ? {} : { gen },
      );
    },
    /** Before initialise is sent: its answer may be lost, but a payment may exist. */
    markStarted(
      userId: string,
      kind: CheckoutKind,
      bookingId: string,
      gen?: number,
    ): Promise<void> {
      return update(
        userId,
        kind,
        bookingId,
        (e) => ({ ...e, paymentEverStarted: true }),
        gen === undefined ? {} : { gen },
      );
    },
    /**
     * A failed payment: the entry (and its breakdown) stays for Try again; the flag stays. With
     * `expectedReference`, only while the entry still holds that payment.
     */
    clearPayment(
      userId: string,
      kind: CheckoutKind,
      bookingId: string,
      expectedReference?: string,
    ): Promise<void> {
      return update(
        userId,
        kind,
        bookingId,
        (e) => ({ ...e, payment: null }),
        expectedReference === undefined ? {} : { expected: expectedReference },
      );
    },
    /** With `expectedReference`, only while the entry holds that payment (or none). */
    drop(
      userId: string,
      kind: CheckoutKind,
      bookingId: string,
      expectedReference?: string,
    ): Promise<void> {
      return enqueue(async () => {
        const key = keyOf(userId, kind, bookingId);
        if (expectedReference !== undefined) {
          const entry = await read(key);
          if (entry && !holds(entry, expectedReference)) return;
        }
        await removeKey(key);
      });
    },
    /** This user's live entries; older than 24 h (or unreadable) are deleted, not returned. */
    list(userId: string): Promise<CheckoutEntry[]> {
      return enqueue(async () => {
        const mine = `${CHECKOUT_PREFIX}${userId}.`;
        const out: CheckoutEntry[] = [];
        for (const key of (await readIndex()).filter((k) => k.startsWith(mine))) {
          const entry = await read(key);
          const created = entry ? Date.parse(entry.createdAt) : NaN;
          if (entry && now() - created <= CHECKOUT_TTL_MS) out.push(entry);
          else await removeKey(key);
        }
        return out;
      });
    },
    /** Every user's entries on this device (sign-out): every key either index names. */
    wipe(): Promise<void> {
      generation += 1;
      return enqueue(async () => {
        const named = new Set([...(await readIndex()), ...(await readKeys(CHECKOUT_KEYS))]);
        const mine = [...named].filter((k) => k.startsWith(CHECKOUT_PREFIX));
        await Promise.all(mine.map((k) => kv.delete(k)));
        await kv.delete(CHECKOUT_INDEX);
        await kv.delete(CHECKOUT_KEYS);
      });
    },
  };
}

export type CheckoutStore = ReturnType<typeof createCheckoutStore>;

export const checkoutStore: CheckoutStore = createCheckoutStore(plainKv);

// Registered on import; src/app/_layout.tsx imports this so a sign-out always clears it, even in a
// session that never opens customer mode.
registerAlwaysWipe(() => checkoutStore.wipe());
