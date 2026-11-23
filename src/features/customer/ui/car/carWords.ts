import type {
  PricingModel,
  Purpose,
  TripType,
  VehicleType,
} from '@/features/customer/domain/carRental/carRequest';
import { formatNaira } from '@/shared/lib/formatNaira';
import { shortDate, type IsoDate } from '@/shared/lib/lagosDay';

// The car rental flow's words. Types, seat counts and examples are the web form's
// (`app/(user)/rent-car/page.jsx`), so a vendor reads the same thing the customer chose.

export const VEHICLE: Record<VehicleType, { label: string; seats: string; example: string }> = {
  sedan: { label: 'Sedan', seats: '4 seats', example: 'Toyota Camry' },
  suv: { label: 'SUV or jeep', seats: '5–7 seats', example: 'Land Cruiser' },
  minivan: { label: 'Minivan', seats: '7 seats', example: 'Toyota Sienna' },
  luxury: { label: 'Luxury', seats: 'Executive', example: 'Mercedes' },
  bus: { label: 'Bus', seats: '16–18 seats', example: 'Toyota Hiace' },
  coaster: { label: 'Coaster', seats: '28+ seats', example: 'Toyota Coaster' },
  pickup: { label: 'Pickup', seats: 'Truck', example: 'Toyota Hilux' },
};

export const TRIP: Record<TripType, { label: string; blurb: string; short: string }> = {
  chauffeur: {
    label: 'With a driver',
    blurb: 'The company sends a driver with the car.',
    short: 'with a driver',
  },
  self_drive: {
    label: 'I’ll drive',
    blurb: 'Self-drive. Bring your driver’s licence to pick-up.',
    short: 'self-drive',
  },
};

export const PRICING: Record<PricingModel, string> = {
  full_day: 'Full day',
  half_day: 'Half day',
  hourly: 'Hourly',
  per_km: 'Per km',
  multi_day: '2+ days',
  fixed: 'Fixed trip',
};

export const PURPOSE: Record<Purpose, string> = {
  leisure: 'Leisure',
  corporate: 'Corporate',
  airport: 'Airport transfer',
  wedding: 'Wedding',
  other: 'Other',
};

/** The words a guide price is "a …" of; null when the price isn't per period. */
export const PRICE_UNIT: Partial<Record<PricingModel, string>> = {
  full_day: 'a day',
  half_day: 'a half day',
  hourly: 'an hour',
  per_km: 'a km',
  multi_day: 'a day',
};

/** `13:30` → `1:30 pm`. */
export function timeWords(hhmm: string): string {
  const h = Number(hhmm.slice(0, 2));
  const m = hhmm.slice(3, 5);
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${String(twelve)}:${m} ${h < 12 ? 'am' : 'pm'}`;
}

/** `Fri 5 Dec`, `Fri 5 → Sun 7 Dec` (one month), `Wed 31 Dec → Fri 2 Jan`. */
export function dateRange(from: IsoDate, to: IsoDate | null): string {
  if (to === null || to === from) return shortDate(from);
  const a = shortDate(from);
  const b = shortDate(to);
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return sameMonth ? `${a.split(' ').slice(0, 2).join(' ')} → ${b}` : `${a} → ${b}`;
}

export function daysWords(n: number): string {
  return n === 1 ? '1 day' : `${String(n)} days`;
}

export function peopleWords(n: number): string {
  return n === 1 ? '1 person' : `${String(n)} people`;
}

/** Where the car meets them and where the trip ends: `Ikeja, Lagos → Ogun`. */
export function routeWords(r: {
  pickupAddress: string | null;
  pickupState: string;
  destinationState: string | null;
}): string {
  const from = r.pickupAddress === null ? r.pickupState : `${r.pickupAddress}, ${r.pickupState}`;
  return r.destinationState === null || r.destinationState === r.pickupState
    ? from
    : `${from} → ${r.destinationState}`;
}

/** `Toyota Camry 2019`, or the type's name when the company left the car out. */
export function carName(
  v: { make: string | null; model: string | null; year: number | null } | null,
  type: VehicleType | null,
): string {
  const parts = [v?.make, v?.model, v?.year === null ? null : v?.year?.toString()].filter(
    (p): p is string => typeof p === 'string' && p.trim() !== '',
  );
  if (parts.length > 0) return parts.join(' ');
  return type === null ? 'Car' : VEHICLE[type].label;
}

export function guideWords(g: { min: number; max: number }, m: PricingModel): string {
  const unit = PRICE_UNIT[m];
  const range =
    g.min === g.max ? formatNaira(g.min) : `${formatNaira(g.min)}–${formatNaira(g.max)}`;
  return unit === undefined ? `About ${range}` : `About ${range} ${unit}`;
}
