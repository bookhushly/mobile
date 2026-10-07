import type { SignOutCheck } from '@/shared/lib/signOutGuard';

export type SignOutOptions = { keepOfflineData?: boolean; discardUnsyncable?: boolean };

// FR-3.11: never wipe unsynced admissions. Items that can never sync (revoked, rejected request)
// may go only after staff confirm. A failed check keeps the (encrypted) data.
export function planSignOut(
  check: SignOutCheck | null,
  opts: SignOutOptions,
): 'wipe' | 'keep' | { blocked: SignOutCheck } {
  if (opts.keepOfflineData === true || check === null) return 'keep';
  if (check.unsynced > 0) return { blocked: check };
  if (check.unsyncable > 0 && opts.discardUnsyncable !== true) return { blocked: check };
  return 'wipe';
}
