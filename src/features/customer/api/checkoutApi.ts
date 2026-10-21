import {
  checkStatus,
  eventCreated,
  initialized,
  paymentState as paymentStateSchema,
  promoResult,
  roomAvailability as roomAvailabilitySchema,
  serviceCharge as serviceChargeSchema,
  stayCreated,
  verified,
  type CheckStatus,
  type EventCreated,
  type Initialized,
  type PaymentState,
  type PromoResult,
  type RoomAvailability,
  type ServiceCharge,
  type StayCreated,
  type Verified,
} from '@/features/customer/schemas/checkout';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

type Requester = Pick<ApiClient, 'request'>;
type Api<T> = Promise<Result<T, ApiError>>;

export type StayKind = 'hotel' | 'apartment';

// ── Create ───────────────────────────────────────────────────────────────────────────────────────

/** Stay creation is the only booking POST the client may re-send: the key makes a replay safe. */
export function createStay(
  c: Requester,
  kind: StayKind,
  body: object,
  idemKey: string,
): Api<StayCreated> {
  return c.request(`/api/bookings/${kind}`, {
    method: 'POST',
    body,
    schema: stayCreated,
    idempotent: true,
    headers: { 'Idempotency-Key': idemKey },
  });
}

/** Never idempotent: an uncertain answer is resolved by re-reading, not by posting again. */
export function createEvent(c: Requester, body: object, free: boolean): Api<EventCreated> {
  return c.request(free ? '/api/bookings/event/free' : '/api/bookings/event/create', {
    method: 'POST',
    body,
    schema: eventCreated,
  });
}

// ── Before create (public routes: no token) ──────────────────────────────────────────────────────

export function roomAvailability(
  c: Requester,
  roomTypeId: string,
  checkIn: string,
  checkOut: string,
): Api<RoomAvailability> {
  const q = `checkIn=${encodeURIComponent(checkIn)}&checkOut=${encodeURIComponent(checkOut)}`;
  return c.request(`/api/hotels/room-types/${encodeURIComponent(roomTypeId)}/availability?${q}`, {
    auth: false,
    schema: roomAvailabilitySchema,
  });
}

export function validatePromo(
  c: Requester,
  body: { code: string; service_type: string; service_id: string; amount: number },
): Api<PromoResult> {
  return c.request('/api/promo/validate', {
    method: 'POST',
    body,
    auth: false,
    schema: promoResult,
  });
}

export function serviceCharge(c: Requester, type: string): Api<ServiceCharge> {
  return c.request(`/api/service-charges?type=${encodeURIComponent(type)}`, {
    auth: false,
    schema: serviceChargeSchema,
  });
}

// ── Payment ──────────────────────────────────────────────────────────────────────────────────────

/** The body is these keys and nothing else: the server computes the amount (BACKEND_STATUS §9). */
export function initializePayment(
  c: Requester,
  kind: 'event' | StayKind,
  bookingId: string,
  email: string,
): Api<Initialized> {
  return c.request('/api/payment/initialize', {
    method: 'POST',
    body: {
      requestId: bookingId,
      requestType: kind,
      provider: 'paystack',
      currency: 'NGN',
      email,
    },
    schema: initialized,
  });
}

export function checkPayment(
  c: Requester,
  kind: 'event' | StayKind,
  bookingId: string,
): Api<CheckStatus> {
  return c.request('/api/payment/check-status', {
    method: 'POST',
    body: { requestId: bookingId, requestType: kind },
    schema: checkStatus,
  });
}

export function verifyPayment(c: Requester, reference: string): Api<Verified> {
  return c.request('/api/payment/verify', {
    method: 'POST',
    body: { reference, provider: 'paystack' },
    schema: verified,
  });
}

export function paymentState(c: Requester, reference: string): Api<PaymentState> {
  return c.request(`/api/payment/status/${encodeURIComponent(reference)}`, {
    schema: paymentStateSchema,
  });
}
