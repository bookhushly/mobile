import type { BookingKind } from '@/features/customer/domain/myBookings';
import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';

// Review 3, finding 1: an irreversible POST (cancel, transfer) whose answer was lost stays
// "unsettled" for its booking beyond the sheet and the hook instance. While it is, the action only
// re-reads the booking and never posts again: a second POST after the first landed would read as
// a refusal ("Couldn't cancel", "not on your account").

export type UnsettledAction = 'cancel' | 'transfer';
export type Unsettled = {
  action: UnsettledAction;
  /** Phone-clock ms when the POST was sent. */
  sentAt: number;
  /** Transfer only: the address the tickets were sent to (normalised). */
  email: string | null;
  /**
   * The server answered with a 5xx: it was reached and the action failed there (final review
   * I2, K1). A re-read showing the booking unchanged then settles it as not done.
   */
  answered: boolean;
};

/** The POST's own timeout (shared client default) plus a grace for a slow server. */
export const LOST_ANSWER_MS = 15_000 + 30_000;

/**
 * Whether a lost answer could still land. False once the server answered with a 5xx, or once
 * the request timeout plus the grace has passed since it was sent (phone clock, ms).
 */
export function mayStillLand(u: Unsettled, nowMs: number): boolean {
  return !u.answered && nowMs - u.sentAt <= LOST_ANSWER_MS;
}

const pending = new Map<string, Unsettled>();
const keyOf = (userId: string, kind: BookingKind, id: string) => `${userId}|${kind}|${id}`;

export const unsettled = {
  get(userId: string, kind: BookingKind, id: string): Unsettled | null {
    return pending.get(keyOf(userId, kind, id)) ?? null;
  },
  /** Set before the POST goes out, so an unmount mid-flight still leaves the latch. */
  set(userId: string, kind: BookingKind, id: string, u: Unsettled): void {
    pending.set(keyOf(userId, kind, id), u);
  },
  clear(userId: string, kind: BookingKind, id: string): void {
    pending.delete(keyOf(userId, kind, id));
  },
  clearAll(): void {
    pending.clear();
  },
};

// Memory only, but it holds an email address: gone on every sign-out.
registerAlwaysWipe(() => {
  unsettled.clearAll();
  return Promise.resolve();
});
