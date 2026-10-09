// Pure decisions for the delete-account flow (spec §3 flow 5, contract §1.5).

/** Unsynced gate admissions are lost with the account: say so before the form. */
export function deletionGate(unsynced: number): 'warn' | 'proceed' {
  return unsynced > 0 ? 'warn' : 'proceed';
}

/** Warning copy; `unsynced < 0` means the count could not be read. */
export function unsyncedWarning(unsynced: number): string | null {
  if (unsynced < 0) return 'Some admissions may not have synced.';
  if (deletionGate(unsynced) === 'proceed') return null;
  const n = String(unsynced);
  return unsynced === 1
    ? `${n} admission hasn't synced. Deleting your account removes it from this phone.`
    : `${n} admissions haven't synced. Deleting your account removes them from this phone.`;
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
