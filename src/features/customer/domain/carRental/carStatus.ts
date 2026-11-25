// Where a request-for-quote (car rental, logistics) stands, in the customer's words (design 2A: one timeline, ink and
// grey only; the same words in Bookings). Server statuses: web `car_rental_requests_status_check`.

export type RequestStatusName =
  | 'open'
  | 'matched'
  | 'paid'
  | 'in_progress'
  | 'completed'
  | 'disputed'
  | 'refunded'
  | 'cancelled'
  | 'expired';

export type Stage =
  | 'waiting'
  | 'quotes'
  | 'noQuotes'
  | 'chosen'
  | 'booked'
  | 'onTrip'
  | 'done'
  | 'problem'
  | 'refunded'
  | 'cancelled';

/** `expiresAt` null: no deadline set (logistics rows may have none), so it never closes on time. */
type StageInput = { status: RequestStatusName; offerCount: number; expiresAt: string | null };

/**
 * An open request past its deadline takes no new quotes, but the ones it has can still be chosen
 * (select-offer checks the request is open and the offer pending, not the deadline).
 */
export function requestStage(r: StageInput, nowMs: number): Stage {
  switch (r.status) {
    case 'open': {
      if (r.offerCount > 0) return 'quotes';
      if (r.expiresAt === null) return 'waiting';
      const ends = Date.parse(r.expiresAt);
      return Number.isFinite(ends) && ends <= nowMs ? 'noQuotes' : 'waiting';
    }
    case 'expired':
      return 'noQuotes';
    case 'matched':
      return 'chosen';
    case 'paid':
      return 'booked';
    case 'in_progress':
      return 'onTrip';
    case 'completed':
      return 'done';
    case 'disputed':
      return 'problem';
    case 'refunded':
      return 'refunded';
    case 'cancelled':
      return 'cancelled';
  }
}

export function stageWords(s: Stage, offerCount: number): string {
  switch (s) {
    case 'waiting':
      return 'Waiting for quotes';
    case 'quotes':
      return offerCount === 1 ? '1 quote to compare' : `${String(offerCount)} quotes to compare`;
    case 'noQuotes':
      return 'No quotes this time';
    case 'chosen':
      return 'Quote chosen · pay to book';
    case 'booked':
      return 'Booked';
    case 'onTrip':
      return 'On your trip';
    case 'done':
      return 'Trip done';
    case 'problem':
      return 'Problem reported';
    case 'refunded':
      return 'Refunded';
    case 'cancelled':
      return 'Cancelled';
  }
}

/** The customer has something to do: compare, pay, or confirm a trip the company marked done. */
export function needsYou(s: Stage, vendorCompletedAt: string | null): boolean {
  if (s === 'quotes' || s === 'chosen') return true;
  return s === 'onTrip' && vendorCompletedAt !== null;
}

export function isPast(s: Stage): boolean {
  return s === 'done' || s === 'noQuotes' || s === 'cancelled' || s === 'refunded';
}

export type StepMark = 'done' | 'current' | 'later';

/** Request sent · Quotes arrive · You pick one and pay · Your car arrives. */
export function timeline(s: Stage): [StepMark, StepMark, StepMark, StepMark] {
  switch (s) {
    case 'waiting':
    case 'noQuotes':
    case 'cancelled':
      return ['done', 'current', 'later', 'later'];
    case 'quotes':
    case 'chosen':
      return ['done', 'done', 'current', 'later'];
    case 'booked':
    case 'onTrip':
    case 'problem':
    case 'refunded':
      return ['done', 'done', 'done', 'current'];
    case 'done':
      return ['done', 'done', 'done', 'done'];
  }
}

/** Quotes the customer can still choose, lowest first. */
export function pendingQuotes<T extends { amount: number; status: string }>(
  offers: readonly T[],
): T[] {
  return offers.filter((o) => o.status === 'pending').sort((a, b) => a.amount - b.amount);
}

/** The quote spread over the trip's days, for trips longer than one day. */
export function perDay(amount: number, days: number): number | null {
  return days > 1 ? Math.round(amount / days) : null;
}

export function canCancel(status: RequestStatusName): boolean {
  return status === 'open' || status === 'matched' || status === 'paid' || status === 'in_progress';
}

/** The server has taken the money for this request (web `PAID_STATUSES`, plus later states). */
export function isPaidStatus(status: RequestStatusName): boolean {
  return (
    status === 'paid' ||
    status === 'in_progress' ||
    status === 'completed' ||
    status === 'disputed' ||
    status === 'refunded'
  );
}
