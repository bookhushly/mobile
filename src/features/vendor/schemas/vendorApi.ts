import { z } from 'zod';

// Response shapes of the web's vendor routes (web `docs/mobile/VENDOR_API.md`, PR #248). Optional
// and nullable where the contract says a field may be missing; extra fields are ignored.

const str = z.string().nullable().optional();
const num = z.number().nullable().optional();
const bool = z.boolean().nullable().optional();

export const meBody = z.object({
  vendor: z.object({
    id: z.string(),
    business_name: z.string(),
    business_category: z.string().nullable(),
    approved: z.boolean().nullable(),
    status: z.string().nullable(),
    suspended: z.boolean(),
    rejection_reason: z.string().nullable(),
    states: z.array(z.string()),
  }),
});

/** Any request type's fields (car rental, logistics, security); each type fills its own. */
export const apiRequest = z.object({
  id: z.string(),
  status: z.string(),
  expires_at: str,
  created_at: str,
  offer_count: num,
  // car rental
  trip_type: str,
  vehicle_type: str,
  pickup_state: str,
  pickup_address: str,
  destination_state: str,
  destination_address: str,
  pickup_date: str,
  pickup_time: str,
  return_date: str,
  number_of_passengers: num,
  purpose: str,
  additional_notes: str,
  pricing_model: str,
  duration_value: num,
  is_urgent: bool,
  // logistics
  service_type: str,
  pickup_landmark: str,
  delivery_state: str,
  delivery_address: str,
  delivery_landmark: str,
  delivery_date: str,
  delivery_time: str,
  item_description: str,
  item_category: str,
  item_weight: str,
  quantity: num,
  fragile_items: bool,
  perishable_items: bool,
  requires_packaging: bool,
  special_instructions: str,
  // security
  state: str,
  start_date: str,
  number_of_guards: num,
  guard_type: str,
  duration_type: str,
  risk_level: str,
  requires_canine: bool,
  requires_vehicle: bool,
  vip_protection: bool,
});
export type ApiRequest = z.infer<typeof apiRequest>;

export const requestsBody = z.object({
  requests: z.array(apiRequest),
  count: z.number(),
  requestType: z.string(),
});

export const apiOffer = z.object({
  id: z.string(),
  request_id: z.string(),
  request_type: z.string(),
  amount: z.number(),
  status: z.enum(['pending', 'accepted', 'rejected', 'withdrawn', 'expired']),
  created_at: z.string(),
  expires_at: str,
});
export type ApiOffer = z.infer<typeof apiOffer>;

export const requestBody = z.object({ request: apiRequest, myOffer: apiOffer.nullable() });
export const offerBody = z.object({ offer: apiOffer });

export const offersBody = z.object({
  offers: z.array(
    apiOffer.extend({
      request: z
        .object({
          type: z.string(),
          id: z.string(),
          what: str,
          where: str,
          when: str,
          status: z.string(),
        })
        .nullable(),
    }),
  ),
});
export type ApiOfferWithRequest = z.infer<typeof offersBody>['offers'][number];

export const apiJob = apiRequest.extend({
  request_type: z.enum(['car_rental', 'logistics', 'security']),
  matched_at: str,
  picked_up_at: str,
  in_transit_at: str,
  delivered_at: str,
  vendor_completed_at: str,
  completed_at: str,
  customer_first_name: str,
  // Dialable only; anything else is dropped rather than put in a tel: link.
  customer_phone: z
    .string()
    .nullable()
    .optional()
    .transform((v) => (v && /^\+?[0-9 ()-]{7,20}$/.test(v) ? v.replace(/[ ()-]/g, '') : null)),
  selected_offer: z.object({ amount: z.number().nullable().optional() }).nullable().optional(),
  payout_amount: num,
});
export type ApiJob = z.infer<typeof apiJob>;

export const jobsBody = z.object({ jobs: z.array(apiJob) });
export const jobBody = z.object({ job: apiJob });

export const uploadBody = z.object({ url: z.url({ protocol: /^https$/ }) });

export const walletBody = z.object({ data: z.object({ balance: z.coerce.number() }) });

export const apiTransaction = z.object({
  id: z.string(),
  transaction_type: z.string(),
  amount: z.coerce.number(),
  status: z.string(),
  created_at: z.string(),
  description: str,
  metadata: z.object({ bank_name: str, account_number_last2: str }).nullable().optional(),
  withdrawal_status: str,
});
export type ApiTransaction = z.infer<typeof apiTransaction>;
export const transactionsBody = z.object({ data: z.array(apiTransaction) });

export const bankBody = z.object({
  data: z.object({ bank_name: str, bank_account_name: str, account_number_last2: str }),
});

export const withdrawBody = z.object({
  withdrawal: z.object({ id: z.string(), status: z.string(), amount: z.coerce.number() }),
});

/** `GET /api/vendor/bookings` (older route, no contract doc): hotel, apartment and event bookings. */
export const apiStay = z.object({
  id: z.string(),
  booking_type: z.enum(['event', 'apartment', 'hotel']),
  status: z.string().nullable(),
  booking_date: z.string().nullable(),
  check_out_date: z.string().nullable().optional(),
  guests: z.number().nullable(),
  total_amount: z.coerce.number().nullable(),
  guest_name: z.string().nullable().optional(),
  payment_status: z.string().nullable().optional(),
  listings: z.object({ title: z.string().nullable() }).nullable(),
});
export type ApiStay = z.infer<typeof apiStay>;
export const staysBody = z.object({ bookings: z.array(apiStay) });

export const moveBody = z.object({ success: z.literal(true) });
