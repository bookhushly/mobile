import { useSyncExternalStore } from 'react';

import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';

// Spec E7: after a transfer the screen leaves the booking (it is no longer yours) and Bookings
// says where the tickets went. Memory only, one line, masked address; gone on sign-out.

let current: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of listeners) l();
}

const get = (): string | null => current;
const clear = (): void => {
  if (current === null) return;
  current = null;
  emit();
};

export const sentNotice = {
  /** `masked`: the recipient as `maskEmail` shows it. */
  set: (masked: string): void => {
    current = `Tickets sent to ${masked}`;
    emit();
  },
  clear,
  get,
};

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** The "Tickets sent to …" line Bookings shows until it is dismissed. */
export function useSentNotice(): { message: string | null; dismiss: () => void } {
  const message = useSyncExternalStore(subscribe, get, get);
  return { message, dismiss: clear };
}

registerAlwaysWipe(() => {
  clear();
  return Promise.resolve();
});
