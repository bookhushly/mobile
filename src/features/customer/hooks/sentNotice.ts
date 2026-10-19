import { useSyncExternalStore } from 'react';

import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';

// Spec E7: after a transfer the screen leaves the booking (it is no longer yours) and Bookings
// says where the tickets went. Memory only, one line, masked address; gone on sign-out. Keyed by
// user (security S1): another account signed in later never sees it.

type Sent = { userId: string; bookingId: string; message: string };

let current: Sent | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

const get = (): Sent | null => current;
const clear = (): void => {
  if (current === null) return;
  current = null;
  emit();
};

export const sentNotice = {
  /** `masked`: the recipient as `maskEmail` shows it (null when unknown). */
  set: (userId: string, bookingId: string, masked: string | null): void => {
    const message = masked === null ? 'Tickets sent' : `Tickets sent to ${masked}`;
    current = { userId, bookingId, message };
    emit();
  },
  clear,
  /** The line for `userId`, if one is waiting. */
  messageFor: (userId: string): string | null =>
    current !== null && current.userId === userId ? current.message : null,
  /** This booking was just transferred away by this user (its details read "not found" now). */
  isFor: (userId: string, bookingId: string): boolean =>
    current !== null && current.userId === userId && current.bookingId === bookingId,
};

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The "Tickets sent to …" line Bookings shows to `userId` until it is dismissed. */
export function useSentNotice(userId: string): { message: string | null; dismiss: () => void } {
  const sent = useSyncExternalStore(subscribe, get, get);
  const message = sent !== null && sent.userId === userId ? sent.message : null;
  return { message, dismiss: clear };
}

/** Whether `bookingId` was just transferred away by `userId` (re-renders when that changes). */
export function useTransferredAway(userId: string, bookingId: string): boolean {
  const sent = useSyncExternalStore(subscribe, get, get);
  return sent !== null && sent.userId === userId && sent.bookingId === bookingId;
}

registerAlwaysWipe(() => {
  clear();
  return Promise.resolve();
});
