import { z } from 'zod';
import { daysBetween, isIsoDate } from '@/shared/lib/lagosDay';
import { parseNigerianPhone } from '@/shared/lib/phone';
import type { CustomQuestion } from '@/features/customer/schemas/checkout';
import type { RoomRate, TicketPackage } from '@/features/customer/schemas/listings';

export type Guest = { name: string; email: string; phone: string };

export type StaySelection = {
  checkIn: string | null;
  checkOut: string | null;
  // Apartments send `adults` as number_of_guests and ignore rateId, breakfast and promo.
  adults: number;
  children: number;
  rateId: string | null;
  breakfast: Record<string, number>;
  airport: { on: boolean; type: 'pickup' | 'dropoff' | 'both'; code: string | null };
  promo: { codeId: string; discount: number } | null;
  guest: Guest;
  specialRequests: string;
};

export type EventSelection = {
  qty: Record<string, number>;
  answers: Record<string, string>;
  promo: { codeId: string; discount: number } | null;
  guest: Guest;
};

export type StayProblem =
  'dates' | 'minNights' | 'maxGuests' | 'guestName' | 'guestEmail' | 'guestPhone';

export type EventProblem =
  | 'noTickets'
  | 'tooMany'
  | 'overStock'
  | { question: string }
  /** A paid order whose promo covers it: /create refuses ₦0 and /free ignores promos (P19). */
  | 'promoZero'
  /** A package-less event whose price couldn't be read: never treated as free (A7). */
  | 'priceUnavailable'
  | 'guestName'
  | 'guestEmail'
  | 'guestPhone';

export const MAX_TICKETS = 20;
const MAX_NIGHTS = 90;
const MAX_PHONE_LENGTH = 20;

/** The requested rate if it belongs to the room type, then the default, then the cheapest. */
export function defaultRate(
  rates: RoomRate[],
  roomTypeId: string,
  requested: string | null,
): RoomRate | null {
  const own = rates.filter((r) => r.room_type_id === roomTypeId);
  if (own.length === 0) return null;
  const asked = requested === null ? undefined : own.find((r) => r.id === requested);
  if (asked !== undefined) return asked;
  const flagged = own.find((r) => r.is_default === true);
  if (flagged !== undefined) return flagged;
  return own.reduce((a, b) =>
    (b.price_per_night ?? Infinity) < (a.price_per_night ?? Infinity) ? b : a,
  );
}

export function nights(checkIn: string, checkOut: string): number {
  return daysBetween(checkIn, checkOut);
}

function emailOk(email: string): boolean {
  return z.email().safeParse(email.trim()).success;
}

function phoneOk(phone: string): boolean {
  return phone.length <= MAX_PHONE_LENGTH && parseNigerianPhone(phone).ok;
}

function stayNights(s: StaySelection, today: string): number | null {
  const { checkIn, checkOut } = s;
  if (checkIn === null || checkOut === null) return null;
  if (!isIsoDate(checkIn) || !isIsoDate(checkOut)) return null;
  if (checkIn < today) return null;
  const n = nights(checkIn, checkOut);
  return n >= 1 && n <= MAX_NIGHTS ? n : null;
}

export function stayProblems(
  s: StaySelection,
  rules: {
    today: string;
    minNights: number;
    maxGuests: number | null;
    kind: 'hotel' | 'apartment';
  },
): StayProblem[] {
  const out: StayProblem[] = [];
  const n = stayNights(s, rules.today);
  if (n === null) out.push('dates');
  else if (n < rules.minNights) out.push('minNights');
  if (rules.maxGuests !== null && s.adults + s.children > rules.maxGuests) out.push('maxGuests');
  if (s.guest.name.trim() === '') out.push('guestName');
  if (!emailOk(s.guest.email)) out.push('guestEmail');
  if (!phoneOk(s.guest.phone)) out.push('guestPhone');
  return out;
}

/** Positive integers only (P18): zero, negative, NaN and fractional quantities are dropped. */
export function ticketLines(qty: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(qty)) {
    if (Number.isInteger(v) && v > 0) out[k] = v;
  }
  return out;
}

/** Valid ticket lines; with packages, keys matching no package are dropped. */
function validLines(
  qty: Record<string, number>,
  packages: TicketPackage[],
): Record<string, number> {
  const lines = ticketLines(qty);
  if (packages.length === 0) return lines;
  const names = new Set(packages.map((p) => p.name));
  return Object.fromEntries(Object.entries(lines).filter(([k]) => names.has(k)));
}

export function eventProblems(
  s: EventSelection,
  packages: TicketPackage[],
  questions: CustomQuestion[],
  free: boolean,
  /** A package-less listing's ticket price, for the promo check; null when unreadable. */
  listingPrice: number | null = 0,
): EventProblem[] {
  const out: EventProblem[] = [];
  if (packages.length === 0 && listingPrice === null) out.push('priceUnavailable');
  const lines = validLines(s.qty, packages);
  const total = Object.values(lines).reduce((a, b) => a + b, 0);
  if (total === 0) out.push('noTickets');
  if (total > MAX_TICKETS) out.push('tooMany');
  const over = packages.some((p) => {
    const n = lines[p.name];
    return n !== undefined && p.remaining != null && n > p.remaining;
  });
  if (over) out.push('overStock');
  if (!free && total > 0 && s.promo !== null) {
    const subtotal = eventSubtotal(s.qty, packages, listingPrice);
    if (subtotal > 0 && s.promo.discount >= subtotal) out.push('promoZero');
  }
  for (const q of questions) {
    if (q.required && (s.answers[q.id] ?? '').trim() === '') out.push({ question: q.id });
  }
  if (free && s.guest.name.trim() === '') out.push('guestName');
  if (!emailOk(s.guest.email)) out.push('guestEmail');
  if (!phoneOk(s.guest.phone)) out.push('guestPhone');
  return out;
}

/**
 * Preview only; the server recomputes. A package-less listing prices every ticket at
 * `listingPrice` (an unreadable price previews as 0, but is never free: see `isFreeOrder`).
 */
export function eventSubtotal(
  qty: Record<string, number>,
  packages: TicketPackage[],
  listingPrice: number | null,
): number {
  const lines = ticketLines(qty);
  if (packages.length === 0) {
    return Object.values(lines).reduce((a, b) => a + b, 0) * (listingPrice ?? 0);
  }
  return packages.reduce((sum, p) => sum + (lines[p.name] ?? 0) * p.price, 0);
}

/**
 * Free means the subtotal before any promo is 0 (P19 amended 2026-10-21: the free route ignores
 * promos and refuses paid packages). A priced package-less listing never is, nor one whose price
 * couldn't be read (A7: `/free` doesn't check the price).
 */
export function isFreeOrder(
  s: EventSelection,
  packages: TicketPackage[],
  listingPrice: number | null,
): boolean {
  if (packages.length === 0 && (listingPrice === null || listingPrice > 0)) return false;
  if (Object.keys(validLines(s.qty, packages)).length === 0) return false;
  return eventSubtotal(s.qty, packages, listingPrice) === 0;
}

function sorted(rec: Record<string, number>): [string, number][] {
  return Object.entries(rec).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
}

/** Stable JSON of everything sent at create; identical selections share an idempotency key. */
export function selectionFingerprint(
  kind: 'hotel' | 'apartment',
  listingId: string,
  roomTypeId: string | null,
  s: StaySelection,
): string {
  return JSON.stringify({
    kind,
    listingId,
    roomTypeId,
    checkIn: s.checkIn,
    checkOut: s.checkOut,
    adults: s.adults,
    children: s.children,
    rateId: s.rateId,
    breakfast: sorted(s.breakfast),
    airport: s.airport,
    promo: s.promo,
    guest: s.guest,
    specialRequests: s.specialRequests,
  });
}
