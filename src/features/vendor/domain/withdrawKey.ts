import type { KeyValue } from '@/shared/lib/kv';

// The withdrawal idempotency key outlives the screen (web VENDOR_API.md "Retrying"): a vendor who
// retries the same amount after a timeout, even after leaving the app, reuses the key, so the server
// answers with the first withdrawal instead of debiting twice. It holds a random id and an amount,
// no personal data.

type Saved = { key: string; amount: number };

const storageKey = (vendorId: string) => `bh.vendor.withdrawKey.${vendorId}`;

function parse(raw: string | null): Saved | null {
  if (raw === null) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null || !('key' in v) || !('amount' in v)) return null;
    return typeof v.key === 'string' && typeof v.amount === 'number'
      ? { key: v.key, amount: v.amount }
      : null;
  } catch {
    return null;
  }
}

export function createWithdrawKeys(kv: KeyValue, mint: () => string) {
  return {
    /** The key for this amount: the saved one when the amount matches, else a new one (saved first). */
    async forAmount(vendorId: string, amount: number): Promise<string> {
      const saved = parse(await kv.get(storageKey(vendorId)).catch(() => null));
      if (saved !== null && saved.amount === amount) return saved.key;
      const key = mint();
      await kv.set(storageKey(vendorId), JSON.stringify({ key, amount }));
      return key;
    },
    /** After a success, or an answer that proves nothing was debited under this key. */
    async clear(vendorId: string): Promise<void> {
      await kv.delete(storageKey(vendorId)).catch(() => undefined);
    },
  };
}
