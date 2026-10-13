import { z } from 'zod';

import type { MyBooking } from '@/features/customer/domain/myBookings';
import { daysBetween, isIsoDate, lagosToday } from '@/shared/lib/lagosDay';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';
import { plainKv } from '@/shared/platform/storage';
import { secureKv } from '@/shared/platform/secureStore';
import { createEncryptedStore } from '@/shared/supabase/encryptedStore';

export type WalletEntry = MyBooking & {
  tickets?: {
    id: string;
    index: number;
    total: number;
    type: string;
    seat: string | null;
    admittedAt: string | null;
  }[];
  liveOnly?: boolean; // events
  checkInCode?: string | null; // hotels, only when showCheckInCode() is true
};
export type Wallet = { userId: string; savedAt: number; entries: WalletEntry[] };

type Store = {
  getItem(k: string): Promise<string | null>;
  setItem(k: string, v: string): Promise<void>;
  removeItem(k: string): Promise<void>;
};

export const WALLET_KEY = 'bh.wallet';
export const WALLET_MAX = 30;
/** Tickets kept per entry: the most one booking can hold (FR), keeping the blob near C9's 50 KB. */
export const WALLET_MAX_TICKETS = 20;

const isoDate = z.string().refine(isIsoDate, 'Not a calendar date');
const nullableString = z.string().nullable();

// The allow-list of what may be kept offline (C9): no email, phone or amounts. Unknown keys are
// stripped on save and on load.
const walletEntry = z.object({
  kind: z.enum(['event', 'hotel', 'apartment']),
  id: z.string(),
  title: nullableString,
  place: nullableString,
  start: isoDate,
  end: isoDate,
  time: nullableString,
  status: z.string(),
  tone: z.enum(['success', 'warning', 'danger', 'neutral', 'info']),
  paid: z.boolean(),
  pending: z.boolean(),
  when: z.enum(['today', 'upcoming', 'past']),
  next: z.string(),
  imageUrl: nullableString,
  createdAt: nullableString,
  tickets: z
    .array(
      z.object({
        id: z.string(),
        index: z.number(),
        total: z.number(),
        type: z.string(),
        seat: nullableString,
        admittedAt: nullableString,
      }),
    )
    .optional(),
  liveOnly: z.boolean().optional(),
  checkInCode: nullableString.optional(),
}) satisfies z.ZodType<WalletEntry>;

const walletSchema = z.object({
  userId: z.string(),
  savedAt: z.number(),
  entries: z.array(walletEntry),
});

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function createWallet(deps: { store: Store }) {
  // Saves and wipes run one at a time, in call order: a slow save can never land after a wipe.
  // `generation` moves on every wipe; a save whose data was loaded under an older generation
  // (still queued, or loaded before a wipe and saved after it) is dropped when its turn comes.
  let queue: Promise<void> = Promise.resolve();
  let generation = 0;
  // The entries last written (one wallet on disk, so one user), to skip identical rewrites.
  const lastWritten = new Map<string, string>();
  const enqueue = (op: () => Promise<void>): Promise<void> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    // Today and upcoming only (re-checked against `now`: `when` may be stale), soonest first.
    /** Bumped by every wipe; capture it when the data to save starts loading. */
    generation(): number {
      return generation;
    },
    // `gen`: the generation the data was loaded under (default: now). A wipe since then drops it.
    save(userId: string, entries: WalletEntry[], now: number, gen = generation): Promise<void> {
      const calledAt = gen;
      const today = lagosToday(now);
      // Cheap filter and sort first; zod only runs on candidates, in order, until the cap fills
      // (an invalid entry never takes a slot).
      const candidates = entries
        .filter((e) => e.when !== 'past' && isIsoDate(e.end) && daysBetween(today, e.end) >= 0)
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      const kept: WalletEntry[] = [];
      for (const e of candidates) {
        if (kept.length >= WALLET_MAX) break;
        const capped =
          e.tickets === undefined ? e : { ...e, tickets: e.tickets.slice(0, WALLET_MAX_TICKETS) };
        const p = walletEntry.safeParse(capped);
        if (p.success) kept.push(p.data);
      }
      const serialised = JSON.stringify(kept);
      return enqueue(async () => {
        if (calledAt !== generation) return;
        // Same entries as the last write for this user: nothing to do (P2).
        if (lastWritten.get(userId) === serialised) return;
        const w: Wallet = { userId, savedAt: now, entries: kept };
        await deps.store.setItem(WALLET_KEY, JSON.stringify(w));
        lastWritten.clear();
        lastWritten.set(userId, serialised);
      });
    },
    async load(userId: string): Promise<Wallet | null> {
      const raw = await deps.store.getItem(WALLET_KEY);
      if (raw === null) return null;
      const p = walletSchema.safeParse(parseJson(raw));
      return p.success && p.data.userId === userId ? p.data : null;
    },
    wipe(): Promise<void> {
      generation += 1;
      lastWritten.clear();
      return enqueue(() => deps.store.removeItem(WALLET_KEY));
    },
  };
}

// Same AES + SecureStore-key pattern as the session store, with its own fresh-install marker so
// it never marks the install before the session store has wiped its Keychain leftovers.
export const wallet = createWallet({
  store: createEncryptedStore({
    secure: secureKv,
    plain: plainKv,
    randomBytes: (n) => crypto.getRandomValues(new Uint8Array(n)),
    storageKey: WALLET_KEY,
    marker: `${WALLET_KEY}.installed`,
  }),
});

// Wiped on every sign-out, whatever the gate's plan (CLAUDE.md: PII wiped on logout). Registered
// on import; src/app/_layout.tsx imports this so it is registered before anyone can sign out.
registerAlwaysWipe(() => wallet.wipe());
