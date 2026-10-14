import { useQuery } from '@tanstack/react-query';

import {
  listingDetailDb,
  type ApartmentListing,
  type HotelListing,
} from '@/features/customer/api/listingDetailDb';
import type { ListingKind } from '@/features/customer/domain/discover';
import { CustomerLoadError, discoverKeys } from '@/features/customer/hooks/customerKeys';
import { apiErrorOf } from '@/features/customer/hooks/discoverRetry';
import { loadFailed } from '@/features/customer/hooks/loadState';
import type { EventDetail } from '@/features/customer/schemas/listings';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

export type ListingFor = { hotel: HotelListing; apartment: ApartmentListing; event: EventDetail };

type Fetchers = {
  [K in ListingKind]: (id: string) => Promise<Result<ListingFor[K] | null, ApiError>>;
};
const fetchers: Fetchers = {
  hotel: (id) => listingDetailDb.hotel(id),
  apartment: (id) => listingDetailDb.apartment(id),
  event: (id) => listingDetailDb.event(id),
};

// Spec D4: detail is read under RLS. `id` null (a link that isn't a UUID) is "not available"
// without a query.
export function useListing<K extends ListingKind>(
  kind: K,
  id: string | null,
): {
  /** undefined while loading (or failed); null when not found or hidden (e.g. a suspended vendor). */
  data: ListingFor[K] | null | undefined;
  /** Nothing to show: the load failed, or it is paused offline. */
  error: boolean;
  /** The failed load's error (null while paused offline), for the copy (U7). */
  apiError: ApiError | null;
  refetch: () => Promise<unknown>;
} {
  const fetchOne: Fetchers[K] = fetchers[kind];
  const q = useQuery({
    queryKey: discoverKeys.listing(kind, id ?? ''),
    queryFn: async (): Promise<ListingFor[K] | null> => {
      if (id === null) return null;
      const r = await fetchOne(id);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    enabled: id !== null,
  });
  return {
    data: id === null ? null : q.data,
    error: id !== null && loadFailed(q),
    apiError: apiErrorOf(q.error),
    refetch: q.refetch,
  };
}
