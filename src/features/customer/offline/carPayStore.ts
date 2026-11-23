import { z } from 'zod';

import { REUSE_WINDOW_MS } from '@/features/customer/domain/checkout/paymentFlow';
import { clock } from '@/shared/api/instance';
import type { KeyValue } from '@/shared/lib/kv';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';
import { plainKv } from '@/shared/platform/storage';

// Car rental payments started on this device: the Paystack reference (kept 24 h, to settle a
// payment left open) and its checkout URL (kept only for the 30-minute reopen window: an open
// checkout link shows the payer's email and can be paid, so it isn't kept longer). One small
// record, wiped on every sign-out, at most 20 entries. Times are server-clock times.

export const CAR_PAY_KEY = 'bh.carpay';
export const CAR_PAY_TTL_MS = 24 * 60 * 60 * 1000;
export const CAR_PAY_MAX = 20;

const entry = z.object({ reference: z.string().min(1), url: z.string(), startedAt: z.number() });
export type CarPayEntry = z.infer<typeof entry>;
const record = z.record(z.string(), entry);

const keyOf = (userId: string, requestId: string) => `${userId}:${requestId}`;

export function createCarPayStore(kv: KeyValue, now: () => number = Date.now) {
  async function read(): Promise<Record<string, CarPayEntry>> {
    try {
      const raw = await kv.get(CAR_PAY_KEY);
      if (raw === null) return {};
      const p = record.safeParse(JSON.parse(raw));
      if (!p.success) return {};
      const t = now();
      return Object.fromEntries(
        Object.entries(p.data)
          .filter(([, e]) => t - e.startedAt < CAR_PAY_TTL_MS)
          .map(([k, e]) => [k, t - e.startedAt < REUSE_WINDOW_MS ? e : { ...e, url: '' }]),
      );
    } catch {
      return {};
    }
  }
  return {
    async get(userId: string, requestId: string): Promise<CarPayEntry | null> {
      return (await read())[keyOf(userId, requestId)] ?? null;
    },
    /** Throws when the write fails: the caller must not open a checkout it can't find again. */
    async put(userId: string, requestId: string, e: CarPayEntry): Promise<void> {
      const all = { ...(await read()), [keyOf(userId, requestId)]: e };
      const kept = Object.entries(all)
        .sort(([, a], [, b]) => b.startedAt - a.startedAt)
        .slice(0, CAR_PAY_MAX);
      await kv.set(CAR_PAY_KEY, JSON.stringify(Object.fromEntries(kept)));
    },
    async drop(userId: string, requestId: string): Promise<void> {
      const k = keyOf(userId, requestId);
      const kept = Object.entries(await read()).filter(([key]) => key !== k);
      await kv.set(CAR_PAY_KEY, JSON.stringify(Object.fromEntries(kept)));
    },
    async wipe(): Promise<void> {
      await kv.delete(CAR_PAY_KEY);
    },
  };
}

export type CarPayStore = ReturnType<typeof createCarPayStore>;

export const carPayStore: CarPayStore = createCarPayStore(plainKv, () => clock.serverNow());

registerAlwaysWipe(() => carPayStore.wipe());
