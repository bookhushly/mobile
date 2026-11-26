import type {
  Duration,
  GuardType,
  SecurityBody,
} from '@/features/customer/domain/security/securityRequest';
import {
  cancelResult,
  createdRequest,
  okBody,
  priceGuide,
} from '@/features/customer/schemas/carRental';
import {
  securityDetail,
  securityList,
  type SecurityRequest,
} from '@/features/customer/schemas/security';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;
type Api<T> = Promise<Result<T, ApiError>>;

const BASE = '/api/security';
const one = (id: string) => `${BASE}/requests/${encodeURIComponent(id)}`;

// Same contract as car rental and logistics (web `docs/mobile/RFQ_API.md`). Writes are never
// `idempotent`: a lost answer is settled by reading back. Cancelling needs a reason here.

export function submitSecurity(c: Requester, body: SecurityBody): Api<{ id: string }> {
  return c.request(`${BASE}/requests`, { method: 'POST', body, schema: createdRequest });
}

export function listSecurity(
  c: Requester,
  signal?: AbortSignal,
): Api<{ requests: SecurityRequest[]; count: number }> {
  return c.request(`${BASE}/requests?page=1&pageSize=50`, {
    schema: securityList,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function getSecurity(c: Requester, id: string, signal?: AbortSignal): Api<SecurityRequest> {
  return c.request(one(id), {
    schema: securityDetail,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function selectSecurityOffer(c: Requester, id: string, offerId: string): Api<unknown> {
  return c.request(`${one(id)}/select-offer`, {
    method: 'POST',
    body: { offerId },
    schema: okBody,
  });
}

/** The reason is required for security (1–500 characters). */
export function cancelSecurity(
  c: Requester,
  id: string,
  reason: string,
): Api<{ refund: 'none' | 'pending' }> {
  return c.request(`${one(id)}/cancel`, {
    method: 'POST',
    body: { reason: reason.trim().slice(0, 500) },
    schema: cancelResult,
  });
}

export function confirmSecurityDone(c: Requester, id: string): Api<unknown> {
  return c.request(`${one(id)}/confirm-complete`, { method: 'POST', body: {}, schema: okBody });
}

export function reviewSecurity(
  c: Requester,
  id: string,
  rating: number,
  comment: string,
): Api<unknown> {
  const text = comment.trim();
  return c.request(`${one(id)}/review`, {
    method: 'POST',
    body: text === '' ? { rating } : { rating, comment: text.slice(0, 1000) },
    schema: okBody,
  });
}

/** Public, cached 5 min by the server; null with too few vendor rates. */
export function securityPriceGuide(
  c: Requester,
  state: string,
  guardType: GuardType,
  durationType: Duration,
  signal?: AbortSignal,
): Api<{ min: number; max: number } | null> {
  const q = `state=${encodeURIComponent(state)}&guardType=${guardType}&durationType=${durationType}`;
  return c.request(`${BASE}/price-estimate?${q}`, {
    auth: false,
    schema: priceGuide,
    ...(signal === undefined ? {} : { signal }),
  });
}
