import type {
  FactIcon,
  MyOffer,
  OfferStatus,
  RequestDetail,
  VendorRequest,
} from '@/features/vendor/domain/requests';
import type { RequestType } from '@/features/vendor/domain/today';
import type {
  ApiOffer,
  ApiOfferWithRequest,
  ApiRequest,
} from '@/features/vendor/schemas/vendorApi';
import { shortDate } from '@/shared/lib/lagosDay';
import {
  GUARD,
  isDate,
  LOGISTICS_SERVICE,
  photoFor,
  SECURITY_SERVICE,
  summaryFor,
  titleFor,
  TRIP,
  VEHICLE,
  word,
} from '@/features/vendor/api/mapWords';

export const requestTypeOf = (t: string): RequestType | null =>
  t === 'car_rental' || t === 'logistics' || t === 'security' ? t : null;

export function myOfferFrom(o: ApiOffer): MyOffer {
  return { id: o.id, amount: o.amount, status: o.status, sentAt: o.created_at };
}

export function requestFrom(
  r: ApiRequest,
  type: RequestType,
  myOffer: MyOffer | null = null,
): VendorRequest {
  return {
    id: r.id,
    requestType: type,
    title: titleFor(type, r),
    summary: summaryFor(type, r),
    closesAt: r.expires_at ?? '',
    quotes: r.offer_count ?? 0,
    photo: photoFor(type, r),
    myOffer,
  };
}

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

export function requestDetailFrom(
  r: ApiRequest,
  type: RequestType,
  myOffer: MyOffer | null,
): RequestDetail {
  const facts: { icon: FactIcon; title: string; detail: string | null }[] = [];
  let from: string;
  let to: string | null;
  let start: RequestDetail['start'];
  let end: RequestDetail['end'] = null;
  if (type === 'logistics') {
    from = r.pickup_address ?? r.pickup_state ?? '';
    to = r.delivery_address ?? r.delivery_state ?? null;
    start = { label: 'Pick-up', date: r.pickup_date ?? '', time: r.pickup_time ?? null };
    if (isDate(r.delivery_date))
      end = {
        label: 'Arrive by',
        value: shortDate(r.delivery_date),
        detail: r.delivery_time ?? null,
      };
    const extras = [
      r.fragile_items ? 'Fragile items' : null,
      r.perishable_items ? 'Perishable' : null,
      r.requires_packaging ? 'Needs packing' : null,
    ].filter((x): x is string => x !== null);
    facts.push({
      icon: 'package',
      title: word(LOGISTICS_SERVICE, r.service_type, 'Delivery'),
      detail: extras.length > 0 ? extras.join(', ') : (r.item_weight ?? null),
    });
    if (r.vehicle_type)
      facts.push({
        icon: 'truck',
        title: word(VEHICLE, r.vehicle_type, r.vehicle_type),
        detail: null,
      });
  } else if (type === 'car_rental') {
    from = r.pickup_address ?? r.pickup_state ?? '';
    to = r.destination_address ?? r.destination_state ?? null;
    start = { label: 'Pick-up', date: r.pickup_date ?? '', time: r.pickup_time ?? null };
    if (isDate(r.return_date))
      end = { label: 'Return', value: shortDate(r.return_date), detail: null };
    facts.push({ icon: 'car', title: titleFor(type, r), detail: r.is_urgent ? 'Urgent' : null });
    if (r.number_of_passengers)
      facts.push({
        icon: 'users',
        title: plural(r.number_of_passengers, 'person', 'people'),
        detail: r.purpose ?? null,
      });
  } else {
    from = r.state ?? '';
    to = null;
    start = { label: 'Start', date: r.start_date ?? '', time: null };
    if (r.duration_type)
      end = { label: 'How long', value: r.duration_type.replace(/_/g, ' '), detail: null };
    const n = r.number_of_guards ?? 1;
    facts.push({
      icon: 'shield',
      title:
        `${plural(n, 'guard', 'guards')}, ${word(GUARD, r.guard_type, '').toLowerCase()}`.replace(
          /, $/,
          '',
        ),
      detail: r.risk_level ? `Risk: ${r.risk_level}` : null,
    });
    const extras = [
      r.requires_canine ? 'a guard dog' : null,
      r.requires_vehicle ? 'a patrol vehicle' : null,
      r.vip_protection ? 'VIP protection' : null,
    ].filter((x): x is string => x !== null);
    if (extras.length > 0)
      facts.push({ icon: 'note', title: `Also: ${extras.join(', ')}`, detail: null });
  }
  const note = (r.special_instructions ?? r.additional_notes ?? '').trim();
  return {
    ...requestFrom(r, type, myOffer),
    from,
    to,
    start,
    end,
    facts,
    note: note === '' ? null : note,
  };
}

/** Quoted and Won come from my offers: the request snapshot plus my offer on it. */
export function offerRequestFrom(o: ApiOfferWithRequest): VendorRequest | null {
  const type = requestTypeOf(o.request_type);
  if (type === null || o.request === null) return null;
  const s = o.request;
  const what = s.what ?? null;
  const title =
    type === 'logistics'
      ? word(LOGISTICS_SERVICE, what, 'Delivery')
      : type === 'car_rental'
        ? word(VEHICLE, what, word(TRIP, what, 'Car'))
        : `Security, ${word(SECURITY_SERVICE, what, 'guards')}`;
  return {
    id: s.id,
    requestType: type,
    title: title.charAt(0).toUpperCase() + title.slice(1),
    summary: isDate(s.when) ? `${s.where ?? ''} · ${shortDate(s.when)}` : (s.where ?? ''),
    closesAt: '',
    quotes: 0,
    photo: photoFor(type, { vehicle_type: what, service_type: what, trip_type: what }),
    myOffer: myOfferFrom(o),
  };
}

const OFFER_ORDER: Record<OfferStatus, number> = {
  pending: 0,
  accepted: 1,
  rejected: 2,
  expired: 3,
  withdrawn: 4,
};
export const byOfferStatus = (a: VendorRequest, b: VendorRequest) =>
  OFFER_ORDER[a.myOffer?.status ?? 'withdrawn'] - OFFER_ORDER[b.myOffer?.status ?? 'withdrawn'];
