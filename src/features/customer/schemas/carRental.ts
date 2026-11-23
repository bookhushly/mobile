import { z } from 'zod';

import {
  PRICING_MODELS,
  VEHICLE_TYPES,
  type PricingModel,
  type TripType,
  type VehicleType,
} from '@/features/customer/domain/carRental/carRequest';
import { plainText } from '@/features/customer/domain/plainText';

// `/api/car-rental/requests…` (web `docs/mobile/RFQ_API.md`). Ids, status and money are strict;
// display fields fall back to null so one odd column never hides a customer's request.

export const REQUEST_STATUSES = [
  'open',
  'matched',
  'paid',
  'in_progress',
  'completed',
  'disputed',
  'refunded',
  'cancelled',
  'expired',
] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export type CarVehicle = {
  make: string | null;
  model: string | null;
  year: number | null;
  seats: number | null;
  type: VehicleType | null;
  imageUrls: string[];
  verified: boolean;
  /** Only after paying (web rule). */
  plate: string | null;
};
export type CarDriver = {
  name: string | null;
  years: number | null;
  photoUrl: string | null;
  verified: boolean;
};
export type CarOffer = {
  id: string;
  amount: number;
  message: string | null;
  pricingModel: PricingModel | null;
  status: string;
  expiresAt: string | null;
  imageUrls: string[];
  vendor: { id: string; name: string; rating: number | null; reviewCount: number } | null;
  vehicle: CarVehicle | null;
  driver: CarDriver | null;
};
export type CarRequest = {
  id: string;
  status: RequestStatus;
  tripType: TripType;
  vehicleType: VehicleType | null;
  pickupState: string;
  pickupAddress: string | null;
  destinationState: string | null;
  destinationAddress: string | null;
  pickupDate: string;
  returnDate: string;
  /** `HH:MM`. */
  pickupTime: string | null;
  passengers: number;
  purpose: string | null;
  notes: string | null;
  pricingModel: PricingModel | null;
  urgent: boolean;
  expiresAt: string;
  createdAt: string;
  vendorCompletedAt: string | null;
  /** Pending quotes (list) or pending offers counted from `offers` (detail). */
  offerCount: number;
  selectedVendor: { id: string; name: string; phone: string | null } | null;
  selectedOffer: CarOffer | null;
  /** Detail only; the list leaves it empty. */
  offers: CarOffer[];
};

const str = z.string().nullable().optional().catch(null);
const num = z.coerce.number().nullable().optional().catch(null);
const bool = z.boolean().nullable().optional().catch(null);
const urls = z
  .array(z.string())
  .nullable()
  .optional()
  .catch(null)
  .transform((u) => (u ?? []).filter((s) => s.startsWith('https://')));
const vehicleType = z.enum(VEHICLE_TYPES).nullable().optional().catch(null);
const pricingModel = z.enum(PRICING_MODELS).nullable().optional().catch(null);

const vehicle = z
  .object({
    make: str,
    model: str,
    year: num,
    seats: num,
    vehicle_type: vehicleType,
    image_urls: urls,
    is_verified: bool,
    plate_number: str,
  })
  .transform((v): CarVehicle => ({
    make: v.make ?? null,
    model: v.model ?? null,
    year: v.year ?? null,
    seats: v.seats ?? null,
    type: v.vehicle_type ?? null,
    imageUrls: v.image_urls,
    verified: v.is_verified === true,
    plate: v.plate_number ?? null,
  }));

const driver = z
  .object({ full_name: str, years_experience: num, photo_url: str, is_verified: bool })
  .transform((d): CarDriver => ({
    name: d.full_name ?? null,
    years: d.years_experience ?? null,
    photoUrl: d.photo_url?.startsWith('https://') === true ? d.photo_url : null,
    verified: d.is_verified === true,
  }));

const offer = z
  .object({
    id: z.string(),
    // A number, or PostgREST's numeric-as-string; never null coerced to ₦0.
    amount: z
      .union([
        z.number(),
        z
          .string()
          .regex(/^\d+(\.\d+)?$/)
          .transform(Number),
      ])
      .pipe(z.number().nonnegative()),
    message: str,
    pricing_model: pricingModel,
    status: z.string().optional().catch('pending'),
    expires_at: str,
    image_urls: urls,
    vendor: z
      .object({
        id: z.string(),
        business_name: str,
        rating: num,
        review_count: num,
      })
      .nullable()
      .optional()
      .catch(null),
    vehicle: vehicle.nullable().optional().catch(null),
    driver: driver.nullable().optional().catch(null),
  })
  .transform((o): CarOffer => ({
    id: o.id,
    amount: o.amount,
    message: plainText(o.message ?? null),
    pricingModel: o.pricing_model ?? null,
    status: o.status ?? 'pending',
    expiresAt: o.expires_at ?? null,
    imageUrls: o.image_urls,
    vendor:
      o.vendor == null
        ? null
        : {
            id: o.vendor.id,
            name: o.vendor.business_name ?? 'Car rental company',
            rating: o.vendor.rating ?? null,
            reviewCount: o.vendor.review_count ?? 0,
          },
    vehicle: o.vehicle ?? null,
    driver: o.driver ?? null,
  }));

const time = str.transform((t) => (t == null ? null : (/^\d{2}:\d{2}/.exec(t)?.[0] ?? null)));

export const carRequest = z
  .object({
    id: z.string(),
    status: z.enum(REQUEST_STATUSES),
    trip_type: z.enum(['chauffeur', 'self_drive']),
    vehicle_type: vehicleType,
    pickup_state: z.string(),
    pickup_address: str,
    destination_state: str,
    destination_address: str,
    pickup_date: z.string(),
    return_date: z.string(),
    pickup_time: time,
    number_of_passengers: z.coerce.number().int().catch(1),
    purpose: str,
    additional_notes: str,
    pricing_model: pricingModel,
    is_urgent: bool,
    expires_at: z.string(),
    created_at: z.string(),
    vendor_completed_at: str,
    offer_count: num,
    selected_vendor: z
      .object({ id: z.string(), business_name: str, phone_number: str })
      .nullable()
      .optional()
      .catch(null),
    selected_offer: offer.nullable().optional().catch(null),
    vendor_offers: z.array(z.unknown()).optional().catch([]),
  })
  .transform((r): CarRequest => {
    // One malformed offer is dropped, never the request with it.
    const offers = (r.vendor_offers ?? []).flatMap((o) => {
      const p = offer.safeParse(o);
      return p.success ? [p.data] : [];
    });
    return {
      id: r.id,
      status: r.status,
      tripType: r.trip_type,
      vehicleType: r.vehicle_type ?? null,
      pickupState: r.pickup_state,
      pickupAddress: r.pickup_address ?? null,
      destinationState: r.destination_state ?? null,
      destinationAddress: r.destination_address ?? null,
      pickupDate: r.pickup_date,
      returnDate: r.return_date,
      pickupTime: r.pickup_time,
      passengers: r.number_of_passengers,
      purpose: r.purpose ?? null,
      notes: plainText(r.additional_notes ?? null),
      pricingModel: r.pricing_model ?? null,
      urgent: r.is_urgent === true,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      vendorCompletedAt: r.vendor_completed_at ?? null,
      offerCount:
        r.vendor_offers === undefined
          ? (r.offer_count ?? 0)
          : offers.filter((o) => o.status === 'pending').length,
      selectedVendor:
        r.selected_vendor == null
          ? null
          : {
              id: r.selected_vendor.id,
              name: r.selected_vendor.business_name ?? 'Car rental company',
              phone: r.selected_vendor.phone_number ?? null,
            },
      selectedOffer: r.selected_offer ?? null,
      offers,
    };
  });

/** `GET /api/car-rental/requests`: rows that fail to parse are dropped, not the page. */
export const carRequestList = z
  .object({ requests: z.array(z.unknown()), count: z.coerce.number().catch(0) })
  .transform((b) => ({
    requests: b.requests.flatMap((x) => {
      const p = carRequest.safeParse(x);
      return p.success ? [p.data] : [];
    }),
    count: b.count,
  }));

export const carRequestDetail = z.object({ request: carRequest }).transform((b) => b.request);

export const createdRequest = z
  .object({ request: z.object({ id: z.string() }) })
  .transform((b) => b.request);

// No default: a money statement never falls back to the reassuring answer. An unreadable reply
// is "try again", and the screen reads back whether the cancel landed.
export const cancelResult = z.object({ refund: z.enum(['none', 'pending']) });

export const priceGuide = z
  .object({ min: z.coerce.number().nullable(), max: z.coerce.number().nullable() })
  .transform((g) => (g.min === null || g.max === null ? null : { min: g.min, max: g.max }));

export const okBody = z.unknown();
