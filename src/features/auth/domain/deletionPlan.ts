// Pure decisions for the delete-account flow (spec §3 flow 5, contract §1.5).

import type { SignOutCheck } from '@/shared/lib/signOutGuard';

/** What the delete screen warns about: a count, or data only an updated app can read. */
export type Unsynced = number | 'appOutdated';

export function unsyncedFromCheck(c: SignOutCheck): Unsynced {
  return c.appOutdated === true ? 'appOutdated' : c.unsynced;
}

/** Unsynced gate admissions are lost with the account: say so before the form. */
export function deletionGate(unsynced: number): 'warn' | 'proceed' {
  return unsynced > 0 ? 'warn' : 'proceed';
}

/** Warning copy; `unsynced < 0` means the count could not be read. */
export function unsyncedWarning(unsynced: Unsynced): string | null {
  // Recoverable: updating first lets the admissions sync before the account goes.
  if (unsynced === 'appOutdated')
    return 'Update the app first so anything saved on this phone can sync. Deleting your account now removes it from this phone.';
  if (unsynced < 0) return 'Some admissions may not have synced.';
  if (deletionGate(unsynced) === 'proceed') return null;
  const n = String(unsynced);
  return unsynced === 1
    ? `${n} admission hasn’t synced. Deleting your account removes it from this phone.`
    : `${n} admissions haven’t synced. Deleting your account removes them from this phone.`;
}

/**
 * A lost 200 makes the retry a 401 (the account is banned). A refresh that fails with
 * `user_banned` proves the delete went through; anything else is unknown.
 */
export function afterUncertain(
  refreshError: { code?: string; message?: string } | null,
): 'deleted' | 'unknown' {
  if (refreshError === null) return 'unknown';
  if (refreshError.code === 'user_banned') return 'deleted';
  return refreshError.message?.toLowerCase().includes('banned') ? 'deleted' : 'unknown';
}
