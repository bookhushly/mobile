import {
  amenityWords,
  type Category,
  type Filters,
  type HotelAmenity,
} from '@/features/customer/domain/discover';
import { formatNaira } from '@/shared/lib/formatNaira';

// The owner's rule (2026-11-15): filters narrow the list but never empty it. When nothing matches
// exactly, Results says so and shows what's closest, loosening one thing at a time (Airbnb's
// "Remove …" buttons; Nike's "No experiences in Singapore, see others"). True closest-first ranking
// needs the backend to score instead of filter (BACKEND_STATUS §9); this works with today's search.

export type FilterKey =
  | 'price'
  | 'minRating'
  | 'breakfast'
  | 'generator24h'
  | 'guests'
  | 'certified'
  | `amenity:${HotelAmenity}`
  | 'bedrooms'
  | 'furnished'
  | 'generator'
  | 'eventDate';

export type ActiveFilter = { key: FilterKey; label: string };

/** Where a search looks: the words typed and, optionally, a state or city. */
export type Where = { q: string; state?: string; city?: string };

export type NearMatch = {
  /** Why these are offered: the heading over them says it. */
  reason: 'samePlaceNoFilters' | 'filtersElsewhere' | 'otherKind' | 'anywhere';
  category: Category;
  where: Where;
  filters: Filters;
};

// Whole naira through the central formatter (money rule).
const naira = (n: number) => formatNaira(Math.floor(n));
const real = (n: number | undefined): n is number =>
  n !== undefined && Number.isFinite(n) && n >= 1;

function priceLabel(f: Filters): string | null {
  const lo = real(f.priceMin) ? f.priceMin : null;
  const hi = real(f.priceMax) ? f.priceMax : null;
  if (lo !== null && hi !== null) return `${naira(lo)}–${naira(hi)}`;
  if (hi !== null) return `Under ${naira(hi)}`;
  if (lo !== null) return `${naira(lo)} and up`;
  return null;
}

function eventDateLabel(d: NonNullable<Filters['eventDate']>): string {
  if (d === 'today') return 'Today';
  if (d === 'weekend') return 'This weekend';
  return 'That date';
}

/** Each filter that narrows the list, in the words a guest reads (the sort is never one). */
export function activeFilters(cat: Category, f: Filters): ActiveFilter[] {
  const out: ActiveFilter[] = [];
  const price = priceLabel(f);
  if (price !== null) out.push({ key: 'price', label: price });
  switch (cat) {
    case 'hotels':
      if (f.minRating !== undefined)
        out.push({ key: 'minRating', label: `Rated ${String(f.minRating)}+` });
      if (f.breakfastIncluded === true) out.push({ key: 'breakfast', label: 'Breakfast included' });
      if (f.generator24h === true) out.push({ key: 'generator24h', label: 'Has a generator' });
      if (f.guests !== undefined && f.guests > 1)
        out.push({ key: 'guests', label: `${String(Math.floor(f.guests))} guests` });
      if (f.certified === true) out.push({ key: 'certified', label: 'NIHOTOUR certified' });
      for (const a of f.amenities ?? []) out.push({ key: `amenity:${a}`, label: amenityWords(a) });
      return out;
    case 'serviced_apartments':
      if (f.bedrooms !== undefined)
        out.push({
          key: 'bedrooms',
          label: f.bedrooms === 1 ? '1 bedroom' : `${String(f.bedrooms)} bedrooms`,
        });
      if (f.furnished === true) out.push({ key: 'furnished', label: 'Furnished' });
      if (f.generator === true) out.push({ key: 'generator', label: 'Has a generator' });
      return out;
    case 'events':
      if (f.eventDate !== undefined)
        out.push({ key: 'eventDate', label: eventDateLabel(f.eventDate) });
      return out;
  }
}

const isAmenityKey = (k: FilterKey): k is `amenity:${HotelAmenity}` => k.startsWith('amenity:');

/** The same filters without one of them. */
export function withoutFilter(f: Filters, key: FilterKey): Filters {
  const o: Filters = { ...f };
  if (isAmenityKey(key)) {
    const left = (f.amenities ?? []).filter((a) => `amenity:${a}` !== key);
    delete o.amenities;
    return left.length > 0 ? { ...o, amenities: left } : o;
  }
  switch (key) {
    case 'price':
      delete o.priceMin;
      delete o.priceMax;
      return o;
    case 'minRating':
      delete o.minRating;
      return o;
    case 'breakfast':
      delete o.breakfastIncluded;
      return o;
    case 'generator24h':
      delete o.generator24h;
      return o;
    case 'guests':
      delete o.guests;
      return o;
    case 'certified':
      delete o.certified;
      return o;
    case 'bedrooms':
      delete o.bedrooms;
      return o;
    case 'furnished':
      delete o.furnished;
      return o;
    case 'generator':
      delete o.generator;
      return o;
    case 'eventDate':
      delete o.eventDate;
      return o;
  }
}

export const MAX_RAILS = 3;

const KINDS: readonly Category[] = ['hotels', 'serviced_apartments', 'events'];

/**
 * What to look for instead, closest first: the same place without the filters, the filters in
 * other places, other kinds in the same place, then this kind anywhere. Results shows the ones that
 * come back with listings.
 */
export function nearMatchPlan(cat: Category, where: Where, f: Filters): NearMatch[] {
  const hasPlace = where.state !== undefined || where.city !== undefined;
  const hasFilters = activeFilters(cat, f).length > 0;
  const loose: Filters = { sort: f.sort };
  const fresh: Filters = { sort: 'newest' };
  const others = KINDS.filter((k) => k !== cat);
  const plan: NearMatch[] = [];
  if (hasFilters) plan.push({ reason: 'samePlaceNoFilters', category: cat, where, filters: loose });
  if (hasFilters && hasPlace)
    plan.push({ reason: 'filtersElsewhere', category: cat, where: { q: where.q }, filters: f });
  if (hasPlace)
    for (const k of others) plan.push({ reason: 'otherKind', category: k, where, filters: fresh });
  if (hasPlace || where.q !== '')
    plan.push({ reason: 'anywhere', category: cat, where: { q: '' }, filters: loose });
  if (plan.length === 0)
    for (const k of others)
      plan.push({ reason: 'otherKind', category: k, where: { q: '' }, filters: fresh });
  // Three at most: each is a listing request on a 60/min-per-IP budget (perf review, 2026-11-17),
  // and more than three rails isn't worth scrolling.
  return plan.slice(0, MAX_RAILS);
}
