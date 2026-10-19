import {
  claimCodeSent,
  claimCountsBody,
  claimRequest,
  claimResult,
  type ClaimCounts,
  type ClaimResult,
} from '@/features/customer/schemas/actions';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import { err, type Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;

const CLAIM = '/api/bookings/claim';

// §7a. All three need a confirmed customer account (`not_customer` / `email_unverified`).

/** GET (`user` tier): how many guest bookings share the account email. */
export function claimCounts(c: Requester): Promise<Result<ClaimCounts, ApiError>> {
  return c.request(CLAIM, { schema: claimCountsBody });
}

/** POST, no body (`auth` tier + 3 per 15 min per account): email a 6-digit code. */
export function sendClaimCode(c: Requester): Promise<Result<{ sent: true }, ApiError>> {
  return c.request(`${CLAIM}/code`, { method: 'POST', schema: claimCodeSent });
}

/** POST `{code}` (`user` tier, 5 attempts per 15 min per account). Idempotent in effect only. */
export function claim(c: Requester, code: string): Promise<Result<ClaimResult, ApiError>> {
  const body = claimRequest.safeParse({ code });
  if (!body.success) return Promise.resolve(err({ kind: 'validation' }));
  return c.request(CLAIM, { method: 'POST', body: body.data, schema: claimResult });
}
