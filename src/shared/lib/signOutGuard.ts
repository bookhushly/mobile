export type SignOutCheck = { unsynced: number; unsyncable: number };
export type ShiftSummary = {
  admitted: number;
  used: number;
  refused: number;
  couldntCheck: number;
  toSync: number;
};
export type SignOutGuard = {
  check: (userId: string) => Promise<SignOutCheck>;
  syncNow: (userId: string) => Promise<void>;
  wipe: (userId: string) => Promise<void>;
  summary?: (userId: string) => Promise<ShiftSummary | null>;
  resetSummary?: (userId: string) => Promise<void>;
};

// Auth asks "may this account's local data go?" without importing the gate feature (FR-3.11).
const guards: SignOutGuard[] = [];

export function registerSignOutGuard(g: SignOutGuard): void {
  if (!guards.includes(g)) guards.push(g);
}

export async function checkSignOut(userId: string): Promise<SignOutCheck> {
  let unsynced = 0;
  let unsyncable = 0;
  for (const g of guards) {
    const c = await g.check(userId);
    unsynced += c.unsynced;
    unsyncable += c.unsyncable;
  }
  return { unsynced, unsyncable };
}

export async function syncBeforeSignOut(userId: string): Promise<void> {
  for (const g of guards) await g.syncNow(userId);
}

export async function wipeOnSignOut(userId: string): Promise<void> {
  for (const g of guards) {
    try {
      await g.wipe(userId);
    } catch {
      // A failed wipe leaves encrypted data behind; it must not keep the user signed in.
    }
  }
}

// The first guard with something to report wins. A failed read must never block sign-out.
export async function shiftSummary(userId: string): Promise<ShiftSummary | null> {
  try {
    for (const g of guards) {
      const s = await g.summary?.(userId);
      if (s) return s;
    }
  } catch {
    // fall through to null
  }
  return null;
}

export async function resetShiftSummary(userId: string): Promise<void> {
  for (const g of guards) await g.resetSummary?.(userId);
}
