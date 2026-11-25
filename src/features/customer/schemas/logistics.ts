import { z } from 'zod';

import {
  ITEM_CATEGORIES,
  ITEM_WEIGHTS,
  LOGISTICS_VEHICLES,
  SERVICE_TYPES,
  type ItemCategory,
  type ItemWeight,
  type LogisticsVehicle,
  type ServiceType,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { plainText } from '@/features/customer/domain/plainText';
import {
  REQUEST_STATUSES,
  bool,
  num,
  offer,
  str,
  time,
  type CarOffer,
  type RequestStatus,
} from '@/features/customer/schemas/carRental';

// `/api/logistics/requests…` (web `docs/mobile/RFQ_API.md`). Same rules as car rental: ids,
// status and money strict; display fields fall back to null; one bad offer never hides the rest.

export type LogisticsRequest = {
  id: string;
  status: RequestStatus;
  serviceType: ServiceType;
  pickupAddress: string;
  pickupLandmark: string | null;
  pickupState: string;
  pickupDate: string;
  pickupTime: string | null;
  deliveryAddress: string;
  deliveryLandmark: string | null;
  deliveryState: string;
  deliveryDate: string | null;
  itemDescription: string;
  itemCategory: ItemCategory | null;
  itemWeight: ItemWeight | null;
  quantity: number;
  vehicleType: LogisticsVehicle | null;
  fragile: boolean;
  perishable: boolean;
  packaging: boolean;
  insurance: boolean;
  notes: string | null;
  /** Null: no deadline was set on the row. */
  expiresAt: string | null;
  createdAt: string;
  vendorCompletedAt: string | null;
  /** The company's progress after payment (picked up, on the way, delivered). */
  pickedUpAt: string | null;
  inTransitAt: string | null;
  deliveredAt: string | null;
  /** The company's proof-of-delivery photo (https only). */
  proofUrl: string | null;
  offerCount: number;
  selectedVendor: { id: string; name: string; phone: string | null } | null;
  selectedOffer: CarOffer | null;
  offers: CarOffer[];
};

const flag = (v: boolean | null | undefined) => v === true;

export const logisticsRequest = z
  .object({
    id: z.string(),
    status: z.enum(REQUEST_STATUSES),
    service_type: z.enum(SERVICE_TYPES),
    pickup_address: z.string(),
    pickup_landmark: str,
    pickup_state: z.string(),
    pickup_date: z.string(),
    pickup_time: time,
    delivery_address: z.string(),
    delivery_landmark: str,
    delivery_state: z.string(),
    delivery_date: str,
    item_description: z.string(),
    item_category: z.enum(ITEM_CATEGORIES).nullable().optional().catch(null),
    item_weight: z.enum(ITEM_WEIGHTS).nullable().optional().catch(null),
    quantity: num,
    vehicle_type: z.enum(LOGISTICS_VEHICLES).nullable().optional().catch(null),
    fragile_items: bool,
    perishable_items: bool,
    requires_packaging: bool,
    requires_insurance: bool,
    special_instructions: str,
    expires_at: str,
    created_at: z.string(),
    vendor_completed_at: str,
    picked_up_at: str,
    in_transit_at: str,
    delivered_at: str,
    proof_of_delivery_url: str,
    offer_count: num,
    selected_vendor: z
      .object({ id: z.string(), business_name: str, phone_number: str })
      .nullable()
      .optional()
      .catch(null),
    selected_offer: offer.nullable().optional().catch(null),
    vendor_offers: z.array(z.unknown()).optional().catch([]),
  })
  .transform((r): LogisticsRequest => {
    const offers = (r.vendor_offers ?? []).flatMap((o) => {
      const p = offer.safeParse(o);
      return p.success ? [p.data] : [];
    });
    return {
      id: r.id,
      status: r.status,
      serviceType: r.service_type,
      pickupAddress: r.pickup_address,
      pickupLandmark: r.pickup_landmark ?? null,
      pickupState: r.pickup_state,
      pickupDate: r.pickup_date,
      pickupTime: r.pickup_time,
      deliveryAddress: r.delivery_address,
      deliveryLandmark: r.delivery_landmark ?? null,
      deliveryState: r.delivery_state,
      deliveryDate: r.delivery_date ?? null,
      itemDescription: plainText(r.item_description) ?? '',
      itemCategory: r.item_category ?? null,
      itemWeight: r.item_weight ?? null,
      quantity: Math.max(1, Math.trunc(r.quantity ?? 1)),
      vehicleType: r.vehicle_type ?? null,
      fragile: flag(r.fragile_items),
      perishable: flag(r.perishable_items),
      packaging: flag(r.requires_packaging),
      insurance: flag(r.requires_insurance),
      notes: plainText(r.special_instructions ?? null),
      expiresAt: r.expires_at ?? null,
      createdAt: r.created_at,
      vendorCompletedAt: r.vendor_completed_at ?? null,
      pickedUpAt: r.picked_up_at ?? null,
      inTransitAt: r.in_transit_at ?? null,
      deliveredAt: r.delivered_at ?? null,
      proofUrl:
        r.proof_of_delivery_url?.startsWith('https://') === true ? r.proof_of_delivery_url : null,
      offerCount:
        r.vendor_offers === undefined
          ? (r.offer_count ?? 0)
          : offers.filter((o) => o.status === 'pending').length,
      selectedVendor:
        r.selected_vendor == null
          ? null
          : {
              id: r.selected_vendor.id,
              name: r.selected_vendor.business_name ?? 'Logistics company',
              phone: r.selected_vendor.phone_number ?? null,
            },
      selectedOffer: r.selected_offer ?? null,
      offers,
    };
  });

export const logisticsList = z
  .object({ requests: z.array(z.unknown()), count: z.coerce.number().catch(0) })
  .transform((b) => ({
    requests: b.requests.flatMap((x) => {
      const p = logisticsRequest.safeParse(x);
      return p.success ? [p.data] : [];
    }),
    count: b.count,
  }));

export const logisticsDetail = z.object({ request: logisticsRequest }).transform((b) => b.request);
