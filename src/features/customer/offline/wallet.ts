import { z } from 'zod';

import type { MyBooking } from '@/features/customer/domain/myBookings';
import { daysBetween, isIsoDate, lagosToday } from '@/shared/lib/lagosDay';
import { registerSignOutGuard } from '@/shared/lib/signOutGuard';
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
  createdAt: z.string(),
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
  return {
    // Today and upcoming only (re-checked against `now`: `when` may be stale), soonest first.
    async save(userId: string, entries: WalletEntry[], now: number): Promise<void> {
      const today = lagosToday(now);
      const kept: WalletEntry[] = [];
      for (const e of entries) {
        const p = walletEntry.safeParse(e);
        if (p.success && p.data.when !== 'past' && daysBetween(today, p.data.end) >= 0) {
          kept.push(p.data);
        }
      }
      kept.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      const w: Wallet = { userId, savedAt: now, entries: kept.slice(0, WALLET_MAX) };
      await deps.store.setItem(WALLET_KEY, JSON.stringify(w));
    },
    async load(userId: string): Promise<Wallet | null> {
      const raw = await deps.store.getItem(WALLET_KEY);
      if (raw === null) return null;
      const p = walletSchema.safeParse(parseJson(raw));
      return p.success && p.data.userId === userId ? p.data : null;
    },
    async wipe(): Promise<void> {
      await deps.store.removeItem(WALLET_KEY);
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

// Registered on import; src/app/_layout.tsx imports this after the gate guard, so the gate's
// shift summary still comes first. Nothing to sync: the wallet is a read-only copy.
registerSignOutGuard({
  check: () => Promise.resolve({ unsynced: 0, unsyncable: 0 }),
  syncNow: () => Promise.resolve(),
  wipe: async () => {
    await wallet.wipe();
  },
});
