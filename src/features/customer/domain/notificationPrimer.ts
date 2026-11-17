import type { NotificationPermission } from '@/shared/platform/notificationPermission';

export type PrimerInput = {
  /** A signed-in customer (never someone browsing without an account). */
  customer: boolean;
  /** The first-run tour is finished (or switched off), so the two never stack. */
  tourDone: boolean;
  /** This device already showed the primer (either answer). */
  asked: boolean | null;
  permission: NotificationPermission | null;
};

// The primer appears once per device, only while the system prompt is still unanswered: the OS
// shows its prompt one time only, so it is spent only on someone who has just said yes.
export function shouldOfferPrimer(i: PrimerInput): boolean {
  return i.customer && i.tourDone && i.asked === false && i.permission === 'undetermined';
}
