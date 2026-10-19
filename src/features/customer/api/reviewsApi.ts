import { reviewRequest, reviewResult } from '@/features/customer/schemas/actions';
import { reviewsBody, type ReviewsPage } from '@/features/customer/schemas/reviews';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import { err, type Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

export type ReviewKind = 'hotel' | 'apartment';
/** What a review can be posted on (events too). */
export type ReviewTarget = ReviewKind | 'event';

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

// POST (Bearer, `user` tier). Never `idempotent`: a lost answer is settled by posting again only
// on the user's say-so, and a duplicate answers 409 `already_reviewed` (spec E8).
export function postReview(
  c: Requester,
  listingId: string,
  type: ReviewTarget,
  rating: number,
  comment: string,
): Promise<Result<{ id: string }, ApiError>> {
  const body = reviewRequest.safeParse({ listing_type: type, rating, comment });
  if (!body.success) return Promise.resolve(err({ kind: 'validation' }));
  return c.request(`/api/reviews/${encodeURIComponent(listingId)}`, {
    method: 'POST',
    body: body.data,
    schema: reviewResult,
  });
}
