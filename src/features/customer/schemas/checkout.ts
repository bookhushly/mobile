import { z } from 'zod';

import { numeric } from '@/features/customer/schemas/listings';

// Response bodies for in-app booking and payment (Phase 4c; BACKEND_STATUS §5, §7b; web #219 and
// #221, live since 2026-10-21). Strict only on what the app reads; extra keys are stripped.
// Amounts are server-computed and shown, never trusted for pricing.

const amount = numeric.refine(Number.isFinite);
const id = z.string().min(1);
// `name` is null when the join comes back empty (contract check M4): never fail a created booking.
const named = z.object({ id, name: z.string().nullable() });

// ── POST /api/bookings/{hotel,apartment} → 201 (200 + replayed on an idempotent replay) ──────────

export const stayCreated = z.object({
  booking: z.object({
    id,
    type: z.enum(['hotel', 'apartment']),
    status: z.string(),
    payment_status: z.string(),
    total: amount,
    currency: z.string(),
    nights: z.number(),
    check_in_date: z.string(),
    check_out_date: z.string(),
    guest_name: z.string(),
    guest_email: z.string(),
    guest_phone: z.string(),
    // `pricing.room_total` is null on a replay; keys differ per type.
    pricing: z.record(z.string(), amount.nullable()),
    created_at: z.string(),
    hotel: named.optional(),
    room_type: named.optional(),
    apartment: named.optional(),
  }),
  next: z.object({
    payment: z.object({ type: z.string(), id, amount, endpoint: z.string() }),
  }),
  replayed: z.boolean().optional(),
});
export type StayCreated = z.infer<typeof stayCreated>;

// ── POST /api/bookings/event/create ──────────────────────────────────────────────────────────────

export const eventCreated = z.object({
  booking: z.object({
    id,
    status: z.string(),
    payment_status: z.string(),
    total_amount: amount,
    created_at: z.string(),
    listing_id: z.string(),
    ticket_details: z.record(z.string(), z.unknown()),
  }),
});
export type EventCreated = z.infer<typeof eventCreated>;

// ── GET /api/hotels/room-types/{id}/availability ─────────────────────────────────────────────────

export const roomAvailability = z.object({
  totalRooms: z.number(),
  bookedCount: z.number(),
  freeRooms: z.number(),
  available: z.boolean(),
});
export type RoomAvailability = z.infer<typeof roomAvailability>;

// ── POST /api/promo/validate (HTTP 200 either way) ───────────────────────────────────────────────

export const promoResult = z.discriminatedUnion('valid', [
  z.object({
    valid: z.literal(true),
    code_id: id,
    code: z.string(),
    discount_amount: amount,
    discounted_total: amount,
  }),
  z.object({ valid: z.literal(false), error: z.string() }),
]);
export type PromoResult = z.infer<typeof promoResult>;

// ── GET /api/service-charges ─────────────────────────────────────────────────────────────────────

export const serviceCharge = z.object({
  charge: z
    .object({
      charge_type: z.string(),
      charge_value: amount,
      enabled: z.boolean(),
      label: z.string().nullable(),
    })
    .nullable(),
});
export type ServiceCharge = z.infer<typeof serviceCharge>;

// ── POST /api/payment/initialize ─────────────────────────────────────────────────────────────────

export const initialized = z.object({
  success: z.literal(true),
  payment: z.object({
    id,
    reference: id,
    amount,
    base_amount: amount,
    service_charge_amount: amount,
    service_charge_label: z.string().nullable(),
    currency: z.string(),
    // Only ever opened in the system browser: https, never another scheme.
    payment_url: z.url().refine((u) => u.startsWith('https://'), 'payment_url must be https'),
  }),
});
export type Initialized = z.infer<typeof initialized>;

// ── POST /api/payment/check-status ───────────────────────────────────────────────────────────────

const statusPayment = z.object({ reference: id, status: z.string(), created_at: z.string() });

export const checkStatus = z.union([
  z.object({ hasPaid: z.literal(true), payment: statusPayment }),
  z.object({ hasPaid: z.literal(false), hasPending: z.literal(true), payment: statusPayment }),
  z.object({ hasPaid: z.literal(false), hasPending: z.literal(false) }),
]);
export type CheckStatus = z.infer<typeof checkStatus>;

// ── POST /api/payment/verify (unverified is still 200 `verified:false`) ──────────────────────────

export const verified = z.object({
  verified: z.boolean(),
  status: z.string(),
  payment: z.object({ reference: z.string(), status: z.string() }).optional(),
});
export type Verified = z.infer<typeof verified>;

// ── GET /api/payment/status/{reference} ──────────────────────────────────────────────────────────

export const paymentState = z.object({
  payment: z.object({
    reference: id,
    status: z.string(),
    fulfilled: z.boolean(),
    request_type: z.string(),
  }),
  request: z
    .object({ id, status: z.string().nullable(), payment_status: z.string().nullable() })
    .nullable(),
});
export type PaymentState = z.infer<typeof paymentState>;

// ── Event listing `custom_questions` ─────────────────────────────────────────────────────────────
// Web `EventTicketPurchase.jsx` reads `q.id`, `q.label`, `q.type` ('select' | 'textarea' | else
// text input), `q.options` and `q.required`. The brief also accepts `question`/`text` as label.
// Like web, an unknown or missing type is a text input (never dropped: a required question must
// not vanish), `required` may be the string "true", and an empty label falls through.

const questionType = z.enum(['text', 'textarea', 'select']).catch('text');

const customQuestionItem = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String),
    question: z.string().optional(),
    label: z.string().optional(),
    text: z.string().optional(),
    type: questionType,
    options: z.array(z.string()).catch([]),
    required: z
      .unknown()
      .optional()
      .transform((v) => v === true || v === 'true'),
  })
  .transform((q) => ({
    id: q.id,
    label: q.question || q.label || q.text || '',
    type: q.type,
    options: q.options,
    required: q.required,
  }))
  .refine((q) => q.id.length > 0 && q.label.length > 0);
export type CustomQuestion = z.infer<typeof customQuestionItem>;

/** Accepts an array or a JSON string; anything unusable yields `[]`, invalid items are skipped. */
export function parseCustomQuestions(raw: unknown): CustomQuestion[] {
  let list: unknown = raw;
  if (typeof raw === 'string') {
    try {
      list = JSON.parse(raw);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.flatMap((item) => {
    const r = customQuestionItem.safeParse(item);
    return r.success ? [r.data] : [];
  });
}
