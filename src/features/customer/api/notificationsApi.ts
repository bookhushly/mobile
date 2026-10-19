import { withFallback, type Fallback } from '@/features/customer/api/fallback';
import { readAllBody } from '@/features/customer/schemas/actions';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

// POST, no body (Bearer, `user` tier) → the number of rows flipped to read. Unlike the RLS write,
// a stale session is an explicit 401. Any 404 is a deploy without the route (spec E3).
export function readAllNotifications(
  c: Requester,
): Promise<Result<{ updated: number } | Fallback, ApiError>> {
  return withFallback(
    c.request('/api/notifications/read-all', { method: 'POST', schema: readAllBody }),
    true,
  );
}
