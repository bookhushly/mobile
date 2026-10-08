import type { BatchItemResult } from '@/features/gate/schemas/batch';

export type SettledState = 'synced' | 'duplicate' | 'suspect' | 'rejected';

// Requirements §8.5 table. Nothing here un-admits anyone: duplicates and suspects are surfaced
// for the organiser, never undone on the phone.
export function reconcile(r: BatchItemResult): {
  state: SettledState;
  result: Record<string, unknown>;
} {
  if (r.ok)
    return { state: 'synced', result: { code: r.code, checked_in_at: r.checked_in_at ?? null } };
  if (r.code === 'already_checked_in') {
    const result = {
      code: r.code,
      scanned_by: r.scanned_by ?? null,
      checked_in_at: r.checked_in_at ?? null,
    };
    return { state: r.by_me === true ? 'synced' : 'duplicate', result };
  }
  if (r.code === 'invalid_code' || r.code === 'expired_code')
    return { state: 'suspect', result: { code: r.code } };
  return { state: 'rejected', result: { code: r.code } };
}

/** 2 s doubling to 60 s, jittered into the upper half so phones don't retry in lockstep. */
export function backoffMs(attempts: number, random: () => number): number {
  const base = Math.min(60_000, 2_000 * 2 ** attempts);
  return Math.round(base / 2 + (random() * base) / 2);
}
