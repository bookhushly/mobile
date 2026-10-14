import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';

import { fetchReviews, type ReviewKind } from '@/features/customer/api/reviewsApi';
import { CustomerLoadError, discoverKeys } from '@/features/customer/hooks/customerKeys';
import { apiErrorOf, discoverRetry, useRetryAfter } from '@/features/customer/hooks/discoverRetry';
import { loadFailed } from '@/features/customer/hooks/loadState';
import type { Review, ReviewsPage } from '@/features/customer/schemas/reviews';
import { api } from '@/shared/api/instance';
import type { ApiError } from '@/shared/lib/errors';

// Spec D10/D16: the first 3 on detail (pageSize 3), "See all" pages 10 at a time. 30/min per IP,
// so reviews load only when asked for (`enabled`) and a 429 is never retried on its own.
export function useReviews(
  kind: ReviewKind,
  listingId: string,
  pageSize: number,
  opts: { enabled?: boolean } = {},
): {
  reviews: Review[];
  total: number;
  loading: boolean;
  failed: boolean;
  /** The failed load's error (null while paused offline). */
  error: ApiError | null;
  retryAfterSec: number | null;
  hasMore: boolean;
  loadingMore: boolean;
  loadMore: () => void;
  refetch: () => Promise<unknown>;
} {
  const q = useInfiniteQuery<
    ReviewsPage,
    Error,
    InfiniteData<ReviewsPage, number>,
    ReturnType<typeof discoverKeys.reviews>,
    number
  >({
    queryKey: discoverKeys.reviews(kind, listingId, pageSize),
    queryFn: async ({ pageParam, signal }) => {
      const r = await fetchReviews(api, listingId, kind, pageParam, pageSize, signal);
      if (!r.ok) throw new CustomerLoadError(r.error);
      return r.value;
    },
    // The route's pages are 1-based.
    initialPageParam: 1,
    getNextPageParam: (last, all) => (last.hasMore ? all.length + 1 : undefined),
    retry: discoverRetry,
    refetchOnWindowFocus: false,
    enabled: opts.enabled ?? true,
  });
  const error = apiErrorOf(q.error);
  const retryAfterSec = useRetryAfter(error, q.errorUpdatedAt);
  const reviews = useMemo(() => q.data?.pages.flatMap((p) => p.reviews) ?? [], [q.data]);
  const { hasNextPage, isFetching, fetchNextPage } = q;
  const loadMore = useCallback(() => {
    if (!hasNextPage || isFetching || retryAfterSec !== null) return;
    void fetchNextPage();
  }, [hasNextPage, isFetching, retryAfterSec, fetchNextPage]);
  return {
    reviews,
    total: q.data?.pages[0]?.total ?? 0,
    loading: q.isPending && q.fetchStatus === 'fetching',
    failed: loadFailed(q),
    error,
    retryAfterSec,
    hasMore: hasNextPage,
    loadingMore: q.isFetchingNextPage,
    loadMore,
    refetch: q.refetch,
  };
}
