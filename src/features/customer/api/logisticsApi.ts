import type {
  LogisticsBody,
  LogisticsVehicle,
} from '@/features/customer/domain/logistics/logisticsRequest';
import {
  cancelResult,
  createdRequest,
  okBody,
  priceGuide,
} from '@/features/customer/schemas/carRental';
import {
  logisticsDetail,
  logisticsList,
  type LogisticsRequest,
} from '@/features/customer/schemas/logistics';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;
type Api<T> = Promise<Result<T, ApiError>>;

const BASE = '/api/logistics';
const one = (id: string) => `${BASE}/requests/${encodeURIComponent(id)}`;

// Same contract as car rental (web `docs/mobile/RFQ_API.md`). Writes are never `idempotent`: a lost
// answer is settled by reading back, never by sending again. Cancelling needs a reason here.

export function submitLogistics(c: Requester, body: LogisticsBody): Api<{ id: string }> {
  return c.request(`${BASE}/requests`, { method: 'POST', body, schema: createdRequest });
}

export function listLogistics(
  c: Requester,
  signal?: AbortSignal,
): Api<{ requests: LogisticsRequest[]; count: number }> {
  return c.request(`${BASE}/requests?page=1&pageSize=50`, {
    schema: logisticsList,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function getLogistics(
  c: Requester,
  id: string,
  signal?: AbortSignal,
): Api<LogisticsRequest> {
  return c.request(one(id), {
    schema: logisticsDetail,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function selectLogisticsOffer(c: Requester, id: string, offerId: string): Api<unknown> {
  return c.request(`${one(id)}/select-offer`, {
    method: 'POST',
    body: { offerId },
    schema: okBody,
  });
}

/** The reason is required for logistics (1–500 characters). */
export function cancelLogistics(
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

export function confirmDelivered(c: Requester, id: string): Api<unknown> {
  return c.request(`${one(id)}/confirm-complete`, { method: 'POST', body: {}, schema: okBody });
}

export function reviewLogistics(
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
export function logisticsPriceGuide(
  c: Requester,
  state: string,
  vehicleType: LogisticsVehicle,
  signal?: AbortSignal,
): Api<{ min: number; max: number } | null> {
  const q = `state=${encodeURIComponent(state)}&vehicleType=${vehicleType}`;
  return c.request(`${BASE}/price-estimate?${q}`, {
    auth: false,
    schema: priceGuide,
    ...(signal === undefined ? {} : { signal }),
  });
}
