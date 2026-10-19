import { withFallback, type Fallback } from '@/features/customer/api/fallback';
import { mineBody, type MineBookings } from '@/features/customer/schemas/bookings';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

// GET (Bearer, `user` tier). All three lists, newest 50 each. The route never answers 404 itself,
// so any 404 means a deploy without it: fall back to the RLS reads (spec E1).
export function fetchMyBookings(
  c: Requester,
  signal?: AbortSignal,
): Promise<Result<MineBookings | Fallback, ApiError>> {
  return withFallback(
    c.request('/api/bookings/mine', {
      schema: mineBody,
      ...(signal === undefined ? {} : { signal }),
    }),
    true,
  );
}
