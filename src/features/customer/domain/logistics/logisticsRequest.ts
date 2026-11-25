import type { Contact } from '@/features/customer/domain/carRental/carRequest';
import { isIsoDate, type IsoDate } from '@/shared/lib/lagosDay';

// A logistics request as the customer builds it (Phase 6, the car rental pattern). Values are the
// web's own (`components/shared/services/logistics-questionnaire.jsx`, `lib/rfq/schemas.js`); the
// server re-checks all of them.

export const SERVICE_TYPES = ['delivery', 'courier', 'moving', 'cargo'] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const LOGISTICS_VEHICLES = ['bike', 'car', 'van', 'truck', 'trailer'] as const;
export type LogisticsVehicle = (typeof LOGISTICS_VEHICLES)[number];

export const ITEM_CATEGORIES = [
  'documents',
  'electronics',
  'clothing',
  'food',
  'furniture',
  'appliances',
  'other',
] as const;
export type ItemCategory = (typeof ITEM_CATEGORIES)[number];

export const ITEM_WEIGHTS = ['0-5kg', '5-20kg', '20-50kg', '50-100kg', '100kg+'] as const;
export type ItemWeight = (typeof ITEM_WEIGHTS)[number];

export const LOGISTICS_STEPS = [
  'service',
  'pickup',
  'dropoff',
  'when',
  'item',
  'vehicle',
  'check',
] as const;
export type LogisticsStep = (typeof LOGISTICS_STEPS)[number];

export const DESCRIPTION_MAX = 1000;
export const INSTRUCTIONS_MAX = 1000;
export const QUANTITY_MAX = 10_000;
export const ITEM_VALUE_MAX = 9_999_999_999;

export type Place = { address: string; landmark: string; state: string | null };

export type LogisticsDraft = {
  serviceType: ServiceType | null;
  pickup: Place;
  dropoff: Place;
  pickupDate: IsoDate | null;
  /** `HH:MM`; null = any time. */
  pickupTime: string | null;
  /** When it must arrive by; null = no date. */
  deliveryDate: IsoDate | null;
  itemDescription: string;
  itemCategory: ItemCategory | null;
  itemWeight: ItemWeight | null;
  /** Naira, as typed (for insurance). */
  itemValue: string;
  quantity: number;
  /** null = the company picks. */
  vehicleType: LogisticsVehicle | null;
  packaging: boolean;
  insurance: boolean;
  fragile: boolean;
  perishable: boolean;
  notes: string;
};

const NOWHERE: Place = { address: '', landmark: '', state: null };

export const EMPTY_LOGISTICS: LogisticsDraft = {
  serviceType: null,
  pickup: NOWHERE,
  dropoff: NOWHERE,
  pickupDate: null,
  pickupTime: null,
  deliveryDate: null,
  itemDescription: '',
  itemCategory: null,
  itemWeight: null,
  itemValue: '',
  quantity: 1,
  vehicleType: null,
  packaging: false,
  insurance: false,
  fragile: false,
  perishable: false,
  notes: '',
};

const MIN_ADDRESS = 3;
const placeReady = (p: Place) => p.state !== null && p.address.trim().length >= MIN_ADDRESS;

/** The typed value as naira: null when blank; NaN when it isn't a non-negative number. */
function itemValue(d: LogisticsDraft): number | null {
  const raw = d.itemValue.replace(/[,\s₦]/g, '');
  if (raw === '') return null;
  const n = Number(raw);
  // The server's limit (`item_value` max 9,999,999,999): above it would be a 400.
  return Number.isFinite(n) && n >= 0 && n <= ITEM_VALUE_MAX ? n : Number.NaN;
}

export function logisticsStepReady(
  step: LogisticsStep,
  d: LogisticsDraft,
  today: IsoDate,
): boolean {
  switch (step) {
    case 'service':
      return d.serviceType !== null;
    case 'pickup':
      return placeReady(d.pickup);
    case 'dropoff':
      return placeReady(d.dropoff);
    case 'when':
      return (
        d.pickupDate !== null &&
        isIsoDate(d.pickupDate) &&
        d.pickupDate >= today &&
        (d.deliveryDate === null || d.deliveryDate >= d.pickupDate)
      );
    case 'item':
      return (
        d.itemDescription.trim() !== '' &&
        d.itemDescription.trim().length <= DESCRIPTION_MAX &&
        !Number.isNaN(itemValue(d) ?? 0) &&
        Number.isInteger(d.quantity) &&
        d.quantity >= 1 &&
        d.quantity <= QUANTITY_MAX
      );
    case 'vehicle':
      return d.notes.trim().length <= INSTRUCTIONS_MAX;
    case 'check':
      return LOGISTICS_STEPS.every((s) => s === 'check' || logisticsStepReady(s, d, today));
  }
}

export type LogisticsBody = {
  service_type: ServiceType;
  full_name: string;
  email: string;
  phone: string;
  pickup_address: string;
  pickup_landmark?: string;
  pickup_state: string;
  pickup_date: IsoDate;
  pickup_time?: string;
  delivery_address: string;
  delivery_landmark?: string;
  delivery_state: string;
  delivery_date?: IsoDate;
  item_description: string;
  item_category?: ItemCategory;
  item_weight?: ItemWeight;
  item_value?: number;
  quantity: number;
  vehicle_type?: LogisticsVehicle;
  requires_packaging: boolean;
  requires_insurance: boolean;
  fragile_items: boolean;
  perishable_items: boolean;
  special_instructions?: string;
};

/** The body for `POST /api/logistics/requests`, or null while something required is missing. */
export function logisticsBody(d: LogisticsDraft, c: Contact, today: IsoDate): LogisticsBody | null {
  if (!logisticsStepReady('check', d, today)) return null;
  const name = c.fullName.trim();
  const email = c.email.trim();
  const phone = c.phone.trim();
  if (name === '' || email === '' || phone === '') return null;
  // logisticsStepReady('check') has proven these.
  if (
    d.serviceType === null ||
    d.pickup.state === null ||
    d.dropoff.state === null ||
    d.pickupDate === null
  ) {
    return null;
  }
  const body: LogisticsBody = {
    service_type: d.serviceType,
    full_name: name,
    email,
    phone,
    pickup_address: d.pickup.address.trim(),
    pickup_state: d.pickup.state,
    pickup_date: d.pickupDate,
    delivery_address: d.dropoff.address.trim(),
    delivery_state: d.dropoff.state,
    item_description: d.itemDescription.trim(),
    quantity: d.quantity,
    requires_packaging: d.packaging,
    requires_insurance: d.insurance,
    fragile_items: d.fragile,
    perishable_items: d.perishable,
  };
  const pickupLandmark = d.pickup.landmark.trim();
  if (pickupLandmark !== '') body.pickup_landmark = pickupLandmark;
  const dropLandmark = d.dropoff.landmark.trim();
  if (dropLandmark !== '') body.delivery_landmark = dropLandmark;
  if (d.pickupTime !== null) body.pickup_time = d.pickupTime;
  if (d.deliveryDate !== null) body.delivery_date = d.deliveryDate;
  if (d.itemCategory !== null) body.item_category = d.itemCategory;
  if (d.itemWeight !== null) body.item_weight = d.itemWeight;
  const value = itemValue(d);
  if (value !== null) body.item_value = value;
  if (d.vehicleType !== null) body.vehicle_type = d.vehicleType;
  const notes = d.notes.trim();
  if (notes !== '') body.special_instructions = notes;
  return body;
}
