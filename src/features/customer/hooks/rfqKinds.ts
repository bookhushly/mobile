import {
  cancelCarRequest,
  confirmCarTripDone,
  getCarRequest,
  listCarRequests,
  reviewCarTrip,
  selectCarOffer,
  submitCarRequest,
} from '@/features/customer/api/carRentalApi';
import {
  cancelLogistics,
  confirmDelivered,
  getLogistics,
  listLogistics,
  reviewLogistics,
  selectLogisticsOffer,
  submitLogistics,
} from '@/features/customer/api/logisticsApi';
import type { SubmitBody } from '@/features/customer/domain/carRental/carRequest';
import type { LogisticsBody } from '@/features/customer/domain/logistics/logisticsRequest';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import type { CarOffer, CarRequest, RequestStatus } from '@/features/customer/schemas/carRental';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import type { SecurityRequest } from '@/features/customer/schemas/security';
import {
  cancelSecurity,
  confirmSecurityDone,
  getSecurity,
  listSecurity,
  reviewSecurity,
  selectSecurityOffer,
  submitSecurity,
} from '@/features/customer/api/securityApi';
import type { SecurityBody } from '@/features/customer/domain/security/securityRequest';
import type { ApiClient } from '@/shared/api/client';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

// Car rental and logistics are the same request-for-quote flow on the server (web
// `docs/mobile/RFQ_API.md`): request → quotes → choose → pay → confirm done. The hooks take one of
// these descriptors, so the money handling (payment, lost answers) exists once for both.

type Requester = Pick<ApiClient, 'request'>;
type Api<T> = Promise<Result<T, ApiError>>;

/** What every request row has, whatever the service. */
export type RfqRow = {
  id: string;
  status: RequestStatus;
  offerCount: number;
  expiresAt: string | null;
  createdAt: string;
  pickupDate: string;
  pickupState: string;
  vendorCompletedAt: string | null;
  selectedVendor: { id: string; name: string; phone: string | null } | null;
  selectedOffer: CarOffer | null;
  offers: CarOffer[];
};

export type RfqKind<R extends RfqRow, B> = {
  name: 'car' | 'logistics' | 'security';
  /** `requestType` for the payment routes. */
  requestType: 'car_rental' | 'logistics' | 'security';
  get: (c: Requester, id: string, signal?: AbortSignal) => Api<R>;
  list: (c: Requester, signal?: AbortSignal) => Api<{ requests: R[]; count: number }>;
  submit: (c: Requester, body: B) => Api<{ id: string }>;
  select: (c: Requester, id: string, offerId: string) => Api<unknown>;
  cancel: (c: Requester, id: string, reason: string) => Api<{ refund: 'none' | 'pending' }>;
  confirm: (c: Requester, id: string) => Api<unknown>;
  review: (c: Requester, id: string, rating: number, comment: string) => Api<unknown>;
  /** A lost submit answer: is this open row the request just sent? */
  sameAs: (r: R, body: B) => boolean;
  keys: {
    list: (u: string) => readonly unknown[];
    one: (u: string, id: string) => readonly unknown[];
  };
};

export const CAR_KIND: RfqKind<CarRequest, SubmitBody> = {
  name: 'car',
  requestType: 'car_rental',
  get: getCarRequest,
  list: listCarRequests,
  submit: submitCarRequest,
  select: selectCarOffer,
  cancel: cancelCarRequest,
  confirm: confirmCarTripDone,
  review: reviewCarTrip,
  sameAs: (r, b) =>
    r.pickupDate === b.pickup_date &&
    r.pickupState === b.pickup_state &&
    r.tripType === b.trip_type,
  keys: { list: customerKeys.carRequests, one: customerKeys.carRequest },
};

export const LOGISTICS_KIND: RfqKind<LogisticsRequest, LogisticsBody> = {
  name: 'logistics',
  requestType: 'logistics',
  get: getLogistics,
  list: listLogistics,
  submit: submitLogistics,
  select: selectLogisticsOffer,
  cancel: cancelLogistics,
  confirm: confirmDelivered,
  review: reviewLogistics,
  // Two deliveries the same day between the same states are common: the addresses and the item
  // must match too, or a second request would be taken for the first and never sent.
  sameAs: (r, b) =>
    r.pickupDate === b.pickup_date &&
    r.pickupState === b.pickup_state &&
    r.deliveryState === b.delivery_state &&
    r.serviceType === b.service_type &&
    r.pickupAddress.trim() === b.pickup_address &&
    r.deliveryAddress.trim() === b.delivery_address &&
    r.itemDescription.trim() === b.item_description,
  keys: { list: customerKeys.logisticsRequests, one: customerKeys.logisticsRequest },
};

export const SECURITY_KIND: RfqKind<SecurityRequest, SecurityBody> = {
  name: 'security',
  requestType: 'security',
  get: getSecurity,
  list: listSecurity,
  submit: submitSecurity,
  select: selectSecurityOffer,
  cancel: cancelSecurity,
  confirm: confirmSecurityDone,
  review: reviewSecurity,
  // The same place, start day, service and team size: a second, different request is never taken
  // for the first.
  sameAs: (r, b) =>
    r.pickupDate === b.start_date &&
    r.pickupState === b.state &&
    r.service === b.service_type &&
    r.address.trim() === b.service_address &&
    r.guards === b.number_of_guards,
  keys: { list: customerKeys.securityRequests, one: customerKeys.securityRequest },
};
