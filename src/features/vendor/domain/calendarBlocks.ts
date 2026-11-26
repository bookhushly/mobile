import type { IsoDate } from '@/shared/lib/lagosDay';

// The apartment calendar against `/api/vendor/apartments/blocked-dates`: the vendor's blocks are
// stored as ranges with both ends included; a guest's stay holds every night from check-in up to,
// not including, check-out.

/** A vendor's block: every night from `start` to `end`, both included. */
export type Block = { id: string; start: IsoDate; end: IsoDate };
export type Stay = { checkIn: IsoDate; checkOut: IsoDate };
export type Range = { start: IsoDate; end: IsoDate };
export type VendorApartment = { id: string; name: string };

export type TogglePlan =
  | { kind: 'block'; start: IsoDate; end: IsoDate }
  | { kind: 'unblock'; create: Range[]; remove: string[] };

const DAY_MS = 86_400_000;

function ms(d: IsoDate): number {
  const [y = 0, m = 1, day = 1] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

const iso = (t: number): IsoDate => new Date(t).toISOString().slice(0, 10);
const plusDays = (d: IsoDate, n: number): IsoDate => iso(ms(d) + n * DAY_MS);

/** First and last day of the month `anyDay` falls in. */
function monthBounds(anyDay: IsoDate): { first: IsoDate; last: IsoDate } {
  const [y = 0, m = 1] = anyDay.split('-').map(Number);
  return { first: iso(Date.UTC(y, m - 1, 1)), last: iso(Date.UTC(y, m, 0)) };
}

/** Every night from `from` to `to`, both included, clipped to the month. */
function nightsIn(from: IsoDate, to: IsoDate, month: IsoDate): IsoDate[] {
  const { first, last } = monthBounds(month);
  const out: IsoDate[] = [];
  const end = to < last ? to : last;
  for (let d = from > first ? from : first; d <= end; d = plusDays(d, 1)) out.push(d);
  return out;
}

const sortedUnique = (ds: IsoDate[]): IsoDate[] => [...new Set(ds)].sort();

/**
 * The `year`/`month` to ask the route for to cover `month`. The route reads the month before to the
 * 28th of the month after, but for January it starts at December of the same year (after its own
 * end) and finds nothing, so January is asked as February, whose window starts on 1 January.
 */
export function routeMonth(month: IsoDate): { year: number; month: number } {
  const [y = 0, m = 1] = month.split('-').map(Number);
  return { year: y, month: m === 1 ? 2 : m };
}

export function blockedNights(blocks: readonly Block[], month: IsoDate): IsoDate[] {
  return sortedUnique(blocks.flatMap((b) => nightsIn(b.start, b.end, month)));
}

export function bookedNights(stays: readonly Stay[], month: IsoDate): IsoDate[] {
  return sortedUnique(
    stays
      .filter((s) => s.checkOut > s.checkIn)
      .flatMap((s) => nightsIn(s.checkIn, plusDays(s.checkOut, -1), month)),
  );
}

/**
 * What tapping `date` does: a free night becomes a one-night block; a blocked night is opened by
 * removing every block that holds it and recreating the nights either side. The caller creates the
 * pieces before removing the old blocks, so no night is ever open by mistake in between.
 */
export function planToggle(blocks: readonly Block[], date: IsoDate): TogglePlan {
  const holding = blocks.filter((b) => b.start <= date && date <= b.end);
  if (holding.length === 0) return { kind: 'block', start: date, end: date };
  // The holding blocks all contain `date`, so together they're one range: split that once.
  const start = holding.reduce((m, b) => (b.start < m ? b.start : m), date);
  const end = holding.reduce((m, b) => (b.end > m ? b.end : m), date);
  const pieces: Range[] = [];
  if (start < date) pieces.push({ start, end: plusDays(date, -1) });
  if (date < end) pieces.push({ start: plusDays(date, 1), end });
  // A piece another block already covers (left by an earlier try that failed half-way) isn't
  // created again, so retries don't pile up copies.
  const others = blocks.filter((b) => !holding.includes(b));
  const create = pieces.filter((p) => !others.some((b) => b.start <= p.start && p.end <= b.end));
  return { kind: 'unblock', create, remove: holding.map((b) => b.id) };
}
