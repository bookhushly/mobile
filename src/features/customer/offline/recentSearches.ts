import { z } from 'zod';

import { sanitizeSearch, type Category } from '@/features/customer/domain/discover';
import type { KeyValue } from '@/shared/lib/kv';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';
import { plainKv } from '@/shared/platform/storage';

// Recent searches (spec D7): on this device only, per user, at most 8, cleared on every sign-out.
// A search is free text (`q`) or a popular place (`state` or `city`), within one category.

export type RecentSearch = {
  label: string;
  category: Category;
  q?: string;
  state?: string;
  city?: string;
};

export const RECENT_MAX = 8;
const PREFIX = 'bh.recent.';
// Which users have a list, so a sign-out can wipe them all. Outside PREFIX on purpose.
export const RECENT_INDEX_KEY = 'bh.recent-users';
export const recentKey = (userId: string) => `${PREFIX}${userId}`;

const entry = z.object({
  label: z.string(),
  category: z.enum(['hotels', 'serviced_apartments', 'events']),
  q: z.string().optional(),
  state: z.string().optional(),
  city: z.string().optional(),
});
const list = z.array(entry);
const users = z.array(z.string());

function parse<T>(raw: string | null, schema: z.ZodType<T>, fallback: T): T {
  if (raw === null) return fallback;
  try {
    const p = schema.safeParse(JSON.parse(raw));
    return p.success ? p.data : fallback;
  } catch {
    return fallback;
  }
}

// Search text is stored as it will be sent (sanitised); empty parts are dropped.
function clean(e: RecentSearch): RecentSearch | null {
  const out: RecentSearch = { label: e.label.trim(), category: e.category };
  const q = e.q === undefined ? '' : sanitizeSearch(e.q);
  if (q !== '') out.q = q;
  if (e.state !== undefined && e.state.trim() !== '') out.state = e.state.trim();
  if (e.city !== undefined && e.city.trim() !== '') out.city = e.city.trim();
  if (out.q === undefined && out.state === undefined && out.city === undefined) return null;
  if (out.label === '') out.label = out.q ?? out.city ?? out.state ?? '';
  return out;
}

const same = (a: RecentSearch, b: RecentSearch) =>
  a.category === b.category &&
  (a.q ?? '').toLowerCase() === (b.q ?? '').toLowerCase() &&
  (a.state ?? '') === (b.state ?? '') &&
  (a.city ?? '') === (b.city ?? '');

export function createRecentSearches(kv: KeyValue) {
  // Writes run one at a time, in call order: two quick adds never lose one, and a clear is
  // never overtaken by an add queued before it.
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (op: () => Promise<void>): Promise<void> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };

  const get = async (userId: string): Promise<RecentSearch[]> =>
    parse(await kv.get(recentKey(userId)), list, []);

  const write = async (userId: string, next: RecentSearch[]) => {
    const known = parse(await kv.get(RECENT_INDEX_KEY), users, []);
    if (!known.includes(userId)) {
      await kv.set(RECENT_INDEX_KEY, JSON.stringify([...known, userId]));
    }
    await kv.set(recentKey(userId), JSON.stringify(next));
  };

  return {
    get,
    /**
     * `stillSignedIn` runs inside the write queue, right before the write: a sign-out wipe that
     * ran first must never be undone by a late add (e.g. from a screen that is unmounting).
     */
    add(userId: string, e: RecentSearch, stillSignedIn?: () => Promise<boolean>): Promise<void> {
      const c = clean(e);
      if (c === null) return Promise.resolve();
      return enqueue(async () => {
        if (stillSignedIn !== undefined && !(await stillSignedIn().catch(() => false))) return;
        const rest = (await get(userId)).filter((x) => !same(x, c));
        await write(userId, [c, ...rest].slice(0, RECENT_MAX));
      });
    },
    /** Same guard as `add` (security review S2): a late remove never re-creates a wiped list. */
    remove(userId: string, e: RecentSearch, stillSignedIn?: () => Promise<boolean>): Promise<void> {
      const c = clean(e) ?? e;
      return enqueue(async () => {
        if (stillSignedIn !== undefined && !(await stillSignedIn().catch(() => false))) return;
        await write(
          userId,
          (await get(userId)).filter((x) => !same(x, c)),
        );
      });
    },
    /** Every user's list on this device (sign-out). */
    clear(): Promise<void> {
      return enqueue(async () => {
        const known = parse(await kv.get(RECENT_INDEX_KEY), users, []);
        await Promise.all(known.map((u) => kv.delete(recentKey(u))));
        await kv.delete(RECENT_INDEX_KEY);
      });
    },
  };
}

export type RecentSearches = ReturnType<typeof createRecentSearches>;

export const recentSearches: RecentSearches = createRecentSearches(plainKv);

// Registered on import; src/app/_layout.tsx imports this so a sign-out always clears it.
registerAlwaysWipe(() => recentSearches.clear());
