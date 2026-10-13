import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { fetchListings, type ItemFor } from '@/features/customer/api/listingsApi';
import {
  buildListingParams,
  inThisWeekend,
  type Category,
  type Filters,
} from '@/features/customer/domain/discover';
import {
  CustomerLoadError,
  discoverKeys,
  type ListingsWhere,
} from '@/features/customer/hooks/customerKeys';
import { apiErrorOf, discoverRetry, useRetryAfter } from '@/features/customer/hooks/discoverRetry';
import { loadFailed } from '@/features/customer/hooks/loadState';
import type { ListingsPage } from '@/features/customer/schemas/listings';
import { api, clock } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';
import { lagosToday } from '@/shared/lib/lagosDay';

/**
 * "This weekend" is filtered here (the route takes one date only). A page with nothing from the
 * weekend reads on, up to this many server pages per page shown, so a run of empty pages never
 * reads as "No matches" while the 60/min budget is still respected.
 */
export const WEEKEND_MAX_PAGES = 3;

function eventDateOf(item: object): string | null {
  const d: unknown = Reflect.get(item, 'event_date');
  return typeof d === 'string' ? d : null;
}

async function loadPage<C extends Category>(
  cat: C,
  where: ListingsWhere,
  filters: Filters,
  firstPage: number,
  signal: AbortSignal,
): Promise<ListingsPage<ItemFor[C]>> {
  const today = lagosToday(clock.serverNow());
  let page = firstPage;
  for (let read = 1; ; read += 1) {
    const { params, clientFilter } = buildListingParams(cat, { ...where, page }, filters, today);
    const r = await fetchListings(api, cat, params, signal);
    if (!r.ok) throw new CustomerLoadError(r.error);
    if (clientFilter !== 'weekend') return r.value;
    const items = r.value.items.filter((i) => inThisWeekend(eventDateOf(i), today));
    const next = r.value.nextPage;
    // The route's count is for every date, so it isn't shown for a client-filtered list.
    if (items.length > 0 || next === undefined || read >= WEEKEND_MAX_PAGES)
      return { items, nextPage: next, totalCount: null };
    page = next;
  }
}

export type Listings<T> = {
  items: T[];
  /** The route's count (only when it sent one, and never for "This weekend"). */
  totalCount: number | null;
  /** First load (no data yet, not failed). */
  loading: boolean;
  /** Nothing to show: the first page failed, or is paused offline. */
  failed: boolean;
  /** The last load's error (a failed "load more" keeps the pages already shown). */
  error: ApiError | null;
  /** Seconds the server asked to wait after a 429, while waiting; else null. */
  retryAfterSec: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  /** Next page; a no-op while one is loading, at the end, or inside a 429's Retry-After. */
  loadMore: () => void;
  refetch: () => Promise<unknown>;
};

// Spec D2/D16: GET /api/listings, 20 a page, infinite. Public (no user in the key), not persisted.
export function useListings<C extends Category>(
  cat: C,
  where: ListingsWhere,
  filters: Filters,
  opts: { enabled?: boolean } = {},
): Listings<ItemFor[C]> {
  const q = useInfiniteQuery<
    ListingsPage<ItemFor[C]>,
    Error,
    InfiniteData<ListingsPage<ItemFor[C]>, number>,
    ReturnType<typeof discoverKeys.listings>,
    number
  >({
    queryKey: discoverKeys.listings(cat, where, filters),
    queryFn: ({ pageParam, signal }) => loadPage(cat, where, filters, pageParam, signal),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextPage,
    retry: discoverRetry,
    enabled: opts.enabled ?? true,
  });
  const error = apiErrorOf(q.error);
  const retryAfterSec = useRetryAfter(error, q.errorUpdatedAt);
  const items = useMemo(() => q.data?.pages.flatMap((p) => p.items) ?? [], [q.data]);
  const { hasNextPage, isFetching, fetchNextPage } = q;
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetching || retryAfterSec !== null) return;
    void fetchNextPage();
  }, [hasNextPage, isFetching, retryAfterSec, fetchNextPage]);
  const failed = loadFailed(q);
  return {
    items,
    totalCount: q.data?.pages[0]?.totalCount ?? null,
    loading: q.isPending && q.fetchStatus === 'fetching',
    failed,
    error,
    retryAfterSec,
    hasMore: hasNextPage,
    loadingMore: q.isFetchingNextPage,
    loadMore,
    refetch: q.refetch,
  };
}
