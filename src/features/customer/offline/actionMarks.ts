import { z } from 'zod';

import type { KeyValue } from '@/shared/lib/kv';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';
import { plainKv } from '@/shared/platform/storage';

// Spec E6 and E8: what this device remembers the customer did, because no route says so (a sent
// refund request, a posted review). Per user, ids only (no PII), wiped on every sign-out. Losing
// it costs a re-post that the server answers with 409, which reads correctly.

/** Oldest ids drop beyond this; a re-post still reads correctly. */
export const MARKS_MAX = 200;

const ids = z.array(z.string());

function parse(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const p = ids.safeParse(JSON.parse(raw));
    return p.success ? p.data : [];
  } catch {
    return [];
  }
}

export function createMarkSet(kv: KeyValue, prefix: string, indexKey: string) {
  // One write at a time, in call order: two quick adds never lose one, and a sign-out wipe is
  // never overtaken by an add queued before it.
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (op: () => Promise<void>): Promise<void> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };
  const key = (userId: string) => `${prefix}${userId}`;
  const get = async (userId: string): Promise<string[]> => parse(await kv.get(key(userId)));

  return {
    key,
    get,
    /**
     * `stillSignedIn` runs inside the queue, right before the write: a late add (a POST that
     * answered after sign-out) never re-creates a wiped set.
     */
    add(userId: string, id: string, stillSignedIn: () => Promise<boolean>): Promise<void> {
      return enqueue(async () => {
        if (!(await stillSignedIn().catch(() => false))) return;
        const known = parse(await kv.get(indexKey));
        if (!known.includes(userId)) await kv.set(indexKey, JSON.stringify([...known, userId]));
        const rest = (await get(userId)).filter((x) => x !== id);
        await kv.set(key(userId), JSON.stringify([...rest, id].slice(-MARKS_MAX)));
      });
    },
    /** Every user's set on this device (sign-out). */
    clear(): Promise<void> {
      return enqueue(async () => {
        const known = parse(await kv.get(indexKey));
        await Promise.all(known.map((u) => kv.delete(key(u))));
        await kv.delete(indexKey);
      });
    },
  };
}

export type MarkSet = ReturnType<typeof createMarkSet>;

/** Listing ids the customer has reviewed (`bh.reviewed.<uid>`). */
export const reviewedMarks: MarkSet = createMarkSet(plainKv, 'bh.reviewed.', 'bh.reviewed-users');
/** Event booking ids with a refund request sent (`bh.refund-req.<uid>`). */
export const refundMarks: MarkSet = createMarkSet(plainKv, 'bh.refund-req.', 'bh.refund-req-users');

// Registered on import; src/app/_layout.tsx imports this so a sign-out always clears both.
registerAlwaysWipe(() => reviewedMarks.clear());
registerAlwaysWipe(() => refundMarks.clear());
