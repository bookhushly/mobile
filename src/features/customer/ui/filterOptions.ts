import type { Filters, PickedDate } from '@/features/customer/domain/discover';
import { isIsoDate, type IsoDate } from '@/shared/lib/lagosDay';

// The filters sheet's choices and the small conversions behind its fields (spec D8).

export const NO_FILTERS: Filters = { sort: 'newest' };
const PICK_DAYS = 30;
const DAY_MS = 86_400_000;

export const isPicked = (s: string): s is PickedDate => isIsoDate(s);
export const digits = (t: string) => t.replace(/\D/g, '').slice(0, 9);
export const toText = (n: number | undefined) => (n === undefined ? '' : String(n));
/** Digits as shown in a price field: "250000" → "250,000" (the stored value stays digits). */
export const grouped = (t: string) => t.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
export const toNaira = (t: string) => (t === '' || Number(t) < 1 ? undefined : Number(t));
export const nextDays = (today: IsoDate) =>
  Array.from({ length: PICK_DAYS }, (_, i) =>
    new Date(Date.parse(`${today}T00:00:00Z`) + (i + 1) * DAY_MS).toISOString().slice(0, 10),
  ).filter(isPicked);

// Drops unset keys, so the same filters always make the same query key.
export function tidy(f: Filters): Filters {
  const out: Filters = { sort: f.sort };
  const entries: [string, unknown][] = Object.entries(f);
  for (const [k, v] of entries) if (v !== undefined) Reflect.set(out, k, v);
  return out;
}

export type Rating = 'any' | '3' | '4' | '4.5';
export type Beds = 'any' | '1' | '2' | '3';
export type When = 'any' | 'today' | 'weekend' | 'pick';
export const RATINGS = [
  { value: 'any', label: 'Any' },
  { value: '3', label: '3+' },
  { value: '4', label: '4+' },
  { value: '4.5', label: '4.5+' },
] as const;
export const BEDS = [
  { value: 'any', label: 'Any' },
  { value: '1', label: '1+' },
  { value: '2', label: '2+' },
  { value: '3', label: '3+' },
] as const;
export const WHENS = [
  { value: 'any', label: 'Any' },
  { value: 'today', label: 'Today' },
  { value: 'weekend', label: 'This weekend' },
  { value: 'pick', label: 'Pick a date' },
] as const;
export const RATING_OF = { any: undefined, '3': 3, '4': 4, '4.5': 4.5 } as const;
export const BEDS_OF = { any: undefined, '1': 1, '2': 2, '3': 3 } as const;
export const ratingKey = (r: Filters['minRating']): Rating =>
  r === undefined ? 'any' : r === 3 ? '3' : r === 4 ? '4' : '4.5';
export const bedsKey = (b: Filters['bedrooms']): Beds =>
  b === undefined ? 'any' : b === 1 ? '1' : b === 2 ? '2' : '3';
