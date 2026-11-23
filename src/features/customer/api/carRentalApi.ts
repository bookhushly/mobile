import type {
  PricingModel,
  SubmitBody,
  VehicleType,
} from '@/features/customer/domain/carRental/carRequest';
import {
  cancelResult,
  carRequestDetail,
  carRequestList,
  createdRequest,
  okBody,
  priceGuide,
  type CarRequest,
} from '@/features/customer/schemas/carRental';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;
type Api<T> = Promise<Result<T, ApiError>>;

const BASE = '/api/car-rental';
const one = (id: string) => `${BASE}/requests/${encodeURIComponent(id)}`;

// Writes are never `idempotent`: a lost answer to a submit or a select is settled by reading the
// list or the request again, never by sending it twice (a second submit is a second request).

export function submitCarRequest(c: Requester, body: SubmitBody): Api<{ id: string }> {
  return c.request(`${BASE}/requests`, { method: 'POST', body, schema: createdRequest });
}

/** `pageSize` is capped at 50 by the route. */
export function listCarRequests(
  c: Requester,
  signal?: AbortSignal,
): Api<{ requests: CarRequest[]; count: number }> {
  return c.request(`${BASE}/requests?page=1&pageSize=50`, {
    schema: carRequestList,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function getCarRequest(c: Requester, id: string, signal?: AbortSignal): Api<CarRequest> {
  return c.request(one(id), {
    schema: carRequestDetail,
    ...(signal === undefined ? {} : { signal }),
  });
}

export function selectCarOffer(c: Requester, id: string, offerId: string): Api<unknown> {
  return c.request(`${one(id)}/select-offer`, {
    method: 'POST',
    body: { offerId },
    schema: okBody,
  });
}

export function cancelCarRequest(
  c: Requester,
  id: string,
  reason: string,
): Api<{ refund: 'none' | 'pending' }> {
  const r = reason.trim();
  return c.request(`${one(id)}/cancel`, {
    method: 'POST',
    body: r === '' ? {} : { reason: r.slice(0, 500) },
    schema: cancelResult,
  });
}

export function confirmCarTripDone(c: Requester, id: string): Api<unknown> {
  return c.request(`${one(id)}/confirm-complete`, { method: 'POST', body: {}, schema: okBody });
}

export function reviewCarTrip(
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

/** Public and cached for 5 min by the server: a guide only, null with too few vendor rates. */
export function carPriceGuide(
  c: Requester,
  state: string,
  vehicleType: VehicleType,
  pricingModel: PricingModel,
  signal?: AbortSignal,
): Api<{ min: number; max: number } | null> {
  const q = `state=${encodeURIComponent(state)}&vehicleType=${vehicleType}&pricingModel=${pricingModel}`;
  return c.request(`${BASE}/price-estimate?${q}`, {
    auth: false,
    schema: priceGuide,
    ...(signal === undefined ? {} : { signal }),
  });
}
