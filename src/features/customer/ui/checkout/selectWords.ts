import type { RefObject } from 'react';
import type { TextInput } from 'react-native';

import type { EventProblem, StayProblem } from '@/features/customer/domain/checkout/selection';
import type { GuestErrors, GuestRefs } from '@/features/customer/ui/checkout/GuestFields';
import { announce } from '@/shared/ui';

// Select screen copy. Sentence case; each line says what to do.

export const DATES_WORDS = 'Choose check-out after check-in, from today';
export const MAX_TICKETS_LINE = 'Up to 20 tickets per booking';
export const NO_ROOMS = 'No rooms left for these dates';
export const QUESTION_WORDS = 'Answer this question';
export const PROMO_ZERO =
  "This code makes your order free, which can't be booked in the app yet. Remove the code or book on bookhushly.com.";
export const PRICE_UNAVAILABLE =
  'This event’s price isn’t available. Try again later or book on bookhushly.com.';

const GUEST_WORDS = {
  guestName: 'Enter your name',
  guestEmail: 'Enter a valid email address',
  guestPhone: 'Enter a Nigerian number, like 0803 123 4567',
} as const;

export const nightsWord = (n: number) => `${String(n)} ${n === 1 ? 'night' : 'nights'}`;
export const ticketsWord = (n: number) => `${String(n)} ${n === 1 ? 'ticket' : 'tickets'}`;

type GuestProblem = keyof typeof GUEST_WORDS;
const isGuest = (p: unknown): p is GuestProblem =>
  p === 'guestName' || p === 'guestEmail' || p === 'guestPhone';

export function guestErrors(problems: readonly unknown[]): GuestErrors {
  const out: GuestErrors = {};
  for (const p of problems) {
    if (p === 'guestName') out.name = GUEST_WORDS.guestName;
    if (p === 'guestEmail') out.email = GUEST_WORDS.guestEmail;
    if (p === 'guestPhone') out.phone = GUEST_WORDS.guestPhone;
  }
  return out;
}

export function stayWords(
  p: StayProblem,
  rules: { minNights: number; maxGuests: number | null },
): string {
  switch (p) {
    case 'dates':
      return DATES_WORDS;
    case 'minNights':
      return `At least ${String(rules.minNights)} nights`;
    case 'maxGuests':
      return rules.maxGuests === null
        ? 'Too many guests'
        : `Up to ${String(rules.maxGuests)} guests`;
    case 'guestName':
    case 'guestEmail':
    case 'guestPhone':
      return GUEST_WORDS[p];
  }
}

export function eventWords(p: EventProblem): string {
  if (typeof p === 'object') return QUESTION_WORDS;
  switch (p) {
    case 'noTickets':
      return 'Choose at least one ticket';
    case 'tooMany':
      return MAX_TICKETS_LINE;
    case 'overStock':
      return 'Not enough tickets left';
    case 'promoZero':
      return PROMO_ZERO;
    case 'priceUnavailable':
      return PRICE_UNAVAILABLE;
    case 'guestName':
    case 'guestEmail':
    case 'guestPhone':
      return GUEST_WORDS[p];
  }
}

function guestRef(p: GuestProblem, refs: GuestRefs): RefObject<TextInput | null> {
  return p === 'guestName' ? refs.name : p === 'guestEmail' ? refs.email : refs.phone;
}

/**
 * Moves to the first problem: a text field takes focus (its error is its hint); anything else
 * (dates, tickets, a choice) is announced.
 */
export function focusFirst<P>(
  problems: readonly P[],
  refs: GuestRefs,
  words: (p: P) => string,
  fieldRef?: (p: P) => RefObject<TextInput | null> | null,
): void {
  const first = problems[0];
  if (first === undefined) return;
  const ref = isGuest(first) ? guestRef(first, refs) : (fieldRef?.(first) ?? null);
  if (ref?.current != null) ref.current.focus();
  else announce(words(first));
}
