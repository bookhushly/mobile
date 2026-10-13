import type { Category } from '@/features/customer/domain/discover';
import {
  apartmentItem,
  eventItem,
  hotelItem,
  listingsPage,
  type ApartmentItem,
  type EventItem,
  type HotelItem,
  type ListingsPage,
} from '@/features/customer/schemas/listings';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

export type ItemFor = {
  hotels: HotelItem;
  serviced_apartments: ApartmentItem;
  events: EventItem;
};

const PAGES: { [C in Category]: ReturnType<typeof listingsPage<ItemFor[C]>> } = {
  hotels: listingsPage(hotelItem),
  serviced_apartments: listingsPage(apartmentItem),
  events: listingsPage(eventItem),
};

// GET /api/listings (spec D2): anonymous on purpose — the route ignores Bearer and the CDN only
// caches requests without it, so `auth: false`. `params` come from buildListingParams (search text
// already sanitised); everything is encoded here, never pasted.
export function fetchListings<C extends Category>(
  c: Requester,
  cat: C,
  params: Readonly<Record<string, string>>,
  signal?: AbortSignal,
): Promise<Result<ListingsPage<ItemFor[C]>, ApiError>> {
  const query = [
    ['category', cat] as const,
    ...Object.entries(params).filter(([k]) => k !== 'category'),
  ]
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&');
  return c.request(`/api/listings?${query}`, {
    schema: PAGES[cat],
    auth: false,
    ...(signal === undefined ? {} : { signal }),
  });
}
