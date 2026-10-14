import { POPULAR_PLACES, type Category, type Filters } from '@/features/customer/domain/discover';
import type { ApiError } from '@/shared/lib/errors';

// Copy for the search, results and filters screens (sentence case).

export const CATEGORY_LABEL: Record<Category, string> = {
  hotels: 'Hotels',
  serviced_apartments: 'Apartments',
  events: 'Events',
};

export const CATEGORY_OPTIONS: readonly { value: Category; label: string }[] = [
  { value: 'hotels', label: 'Hotels' },
  { value: 'serviced_apartments', label: 'Apartments' },
  { value: 'events', label: 'Events' },
];

type Sort = Filters['sort'];

/** For events the route reads `top_rated` as soonest first (D6). */
export function sortLabel(cat: Category, sort: Sort): string {
  switch (sort) {
    case 'newest':
      return 'Newest';
    case 'price_asc':
      return 'Lowest price';
    case 'price_desc':
      return 'Highest price';
    case 'top_rated':
      return cat === 'events' ? 'Soonest' : 'Top rated';
  }
}

export const SORTS: readonly Sort[] = ['newest', 'price_asc', 'price_desc', 'top_rated'];

/** A place's name as the customer chose it ("Abuja" for the FCT); else the raw city or state. */
export function placeLabel(state: string | undefined, city: string | undefined): string | null {
  if (state === undefined && city === undefined) return null;
  const popular = POPULAR_PLACES.find((p) => p.state === state && p.city === city);
  return popular?.label ?? city ?? state ?? null;
}

/** "124 results", "1 result", "1,170 results". */
export function resultCount(n: number): string {
  const grouped = String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${grouped} ${n === 1 ? 'result' : 'results'}`;
}

/**
 * A failed load caused by the connection: no reply, a timeout, or a fetch paused offline (no
 * error at all). Anything else is on the server's side, so "check your connection" would mislead.
 */
export function isConnectionFailure(error: ApiError | null): boolean {
  return error === null || error.kind === 'network' || error.kind === 'timeout';
}

/** Final UX review U7: "Couldn’t load reviews — check your connection." or "… — try again." */
export function loadFailedLine(error: ApiError | null, what = ''): string {
  const next = isConnectionFailure(error) ? 'check your connection' : 'try again';
  return `Couldn’t load${what === '' ? '' : ` ${what}`} — ${next}.`;
}

/** An error screen's message under "Couldn’t load …". */
export function loadFailedMessage(error: ApiError | null): string {
  return isConnectionFailure(error)
    ? 'Check your connection and try again.'
    : 'Try again in a moment.';
}
