import type { ScannableEvent } from '@/shared/api/scannableEvents';

/**
 * A summary 403 carries no code, so on its own it is only a hint. The refusal is shown only when
 * a fresh events list (null: the refetch failed) no longer contains this event.
 */
export function shouldShowNotAssigned(a: {
  summaryForbidden: boolean;
  events: readonly ScannableEvent[] | null;
  eventId: string;
}): boolean {
  return a.summaryForbidden && a.events !== null && !a.events.some((e) => e.id === a.eventId);
}
