// FR-3.15: lock the override for 15 minutes after 5 wrong PINs, persisted across restarts (the
// caller stores the record in SecureStore per account, so it also survives sign-out; the shift
// tally stays in the encrypted DB). Times are the server-corrected clock.
export const MAX_FAILURES = 5;
export const LOCK_MS = 15 * 60_000;

export type LockRecord = { failures: number; lockedUntil: number | null };
export const NO_LOCK: LockRecord = { failures: 0, lockedUntil: null };
export type LockState = { kind: 'open'; triesLeft: number } | { kind: 'locked'; minutesLeft: number };

const isLocked = (rec: LockRecord, nowMs: number) => rec.lockedUntil !== null && nowMs < rec.lockedUntil;

export function lockState(rec: LockRecord, nowMs: number): LockState {
  if (rec.lockedUntil !== null) {
    if (isLocked(rec, nowMs)) {
      // A clock moved back can't stretch the lock beyond its full length.
      const left = Math.min(rec.lockedUntil - nowMs, LOCK_MS);
      return { kind: 'locked', minutesLeft: Math.ceil(left / 60_000) };
    }
    return { kind: 'open', triesLeft: MAX_FAILURES };
  }
  return { kind: 'open', triesLeft: Math.max(0, MAX_FAILURES - rec.failures) };
}

export function afterFailure(rec: LockRecord, nowMs: number): LockRecord {
  const base = rec.lockedUntil !== null && !isLocked(rec, nowMs) ? NO_LOCK : rec;
  const failures = base.failures + 1;
  return failures >= MAX_FAILURES
    ? { failures, lockedUntil: nowMs + LOCK_MS }
    : { failures, lockedUntil: null };
}

export const afterSuccess = (): LockRecord => NO_LOCK;
