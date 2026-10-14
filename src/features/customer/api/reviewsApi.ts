import { reviewsBody, type ReviewsPage } from '@/features/customer/schemas/reviews';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

export type ReviewKind = 'hotel' | 'apartment';

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Number.isFinite(n) ? Math.floor(n) : lo));

// Public (anonymous reads allowed, IP-keyed 30/min): `auth: false`, like the listings route.
// `page` is 1-based; the route caps `limit` at 50.
export function fetchReviews(
  c: Requester,
  listingId: string,
  type: ReviewKind,
  page: number,
  limit: number,
  signal?: AbortSignal,
): Promise<Result<ReviewsPage, ApiError>> {
  const q = `type=${type}&page=${String(clamp(page, 1, Number.MAX_SAFE_INTEGER))}&limit=${String(clamp(limit, 1, 50))}`;
  return c.request(`/api/reviews/${encodeURIComponent(listingId)}?${q}`, {
    schema: reviewsBody,
    auth: false,
    ...(signal === undefined ? {} : { signal }),
  });
}
