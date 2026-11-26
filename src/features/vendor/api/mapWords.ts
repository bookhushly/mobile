import type { PhotoKey, RequestType } from '@/features/vendor/domain/today';
import type { ApiRequest } from '@/features/vendor/schemas/vendorApi';
import { shortDate, stayRange, type IsoDate } from '@/shared/lib/lagosDay';
// Words and photos for request types: the web's stored values as the vendor screens show them.
// The web's vendor responses (web `docs/mobile/VENDOR_API.md`) as the vendor screens' own types,
// so the screens are the same on sample data and live data.

export const LOGISTICS_SERVICE: Record<string, string> = {
  delivery: 'Delivery',
  courier: 'Courier delivery',
  moving: 'Moving',
  cargo: 'Cargo',
};
export const VEHICLE: Record<string, string> = {
  sedan: 'Sedan',
  suv: 'SUV',
  minivan: 'Minivan',
  luxury: 'Luxury car',
  bus: 'Bus',
  coaster: 'Coaster bus',
  pickup: 'Pickup truck',
  bike: 'Motorbike',
  car: 'Car',
  van: 'Van',
  truck: 'Truck',
  trailer: 'Trailer',
};
export const TRIP: Record<string, string> = { chauffeur: 'with driver', self_drive: 'self-drive' };
export const SECURITY_SERVICE: Record<string, string> = {
  residential: 'home',
  corporate: 'business',
  event_security: 'event',
  personal_security: 'personal',
  escort: 'escort',
};
export const GUARD: Record<string, string> = {
  unarmed: 'Unarmed',
  armed: 'Armed',
  both: 'Armed and unarmed',
};

export const word = (map: Record<string, string>, v: string | null | undefined, fallback: string) =>
  (v !== null && v !== undefined ? map[v] : undefined) ?? fallback;

export const isDate = (d: string | null | undefined): d is IsoDate =>
  typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d);

export function photoFor(
  type: RequestType,
  r: Pick<ApiRequest, 'vehicle_type' | 'service_type' | 'trip_type'>,
): PhotoKey {
  if (type === 'security') return 'security';
  if (type === 'car_rental') {
    const v = r.vehicle_type;
    if (v === 'suv' || v === 'pickup') return 'suv';
    if (v === 'bus' || v === 'coaster' || v === 'minivan') return 'bus';
    if (v === 'sedan' || v === 'luxury') return 'sedan';
    return r.trip_type === 'chauffeur' ? 'withDriver' : 'sedan';
  }
  switch (r.vehicle_type) {
    case 'truck':
    case 'trailer':
      return 'truck';
    case 'van':
      return 'van';
    case 'bike':
      return 'motorcycle';
    case 'car':
      return 'sedan';
    case null:
    case undefined:
    default:
      break;
  }
  switch (r.service_type) {
    case 'moving':
      return 'moving';
    case 'courier':
      return 'courier';
    case 'cargo':
      return 'truck';
    case null:
    case undefined:
    default:
      return 'delivery';
  }
}

export function titleFor(type: RequestType, r: ApiRequest): string {
  if (type === 'logistics') {
    const item = r.item_description?.trim() ?? '';
    return item !== '' ? item : word(LOGISTICS_SERVICE, r.service_type, 'Delivery');
  }
  if (type === 'car_rental') {
    const car = word(VEHICLE, r.vehicle_type, 'Car');
    return r.trip_type ? `${car}, ${word(TRIP, r.trip_type, '')}`.replace(/, $/, '') : car;
  }
  const n = r.number_of_guards ?? 1;
  return `${String(n)} ${n === 1 ? 'guard' : 'guards'}, ${word(SECURITY_SERVICE, r.service_type, 'security')}`;
}

export function summaryFor(type: RequestType, r: ApiRequest): string {
  if (type === 'security') {
    const where = r.state ?? '';
    return isDate(r.start_date) ? `${where} · from ${shortDate(r.start_date)}` : where;
  }
  const from = r.pickup_state ?? '';
  const toState = type === 'logistics' ? r.delivery_state : r.destination_state;
  const where = toState && toState !== from ? `${from} → ${toState}` : from;
  const start = r.pickup_date;
  if (!isDate(start)) return where;
  if (type === 'car_rental' && isDate(r.return_date) && r.return_date !== start)
    return `${where} · ${stayRange(start, r.return_date)}`;
  return `${where} · ${shortDate(start)}`;
}
