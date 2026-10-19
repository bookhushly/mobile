import { z } from 'zod';

// Request and response bodies for the Phase 5 customer routes (contract: web
// docs/mobile/CUSTOMER_BOOKINGS_API.md, BACKEND_STATUS §7, §7a, §9 Customer 5). Request bodies are
// built key by key through these schemas: nothing else reaches the server.

const count = z.number().int().nonnegative();
const ids = z.array(z.string()).catch([]);

// ── GET /api/bookings/event/{id}/codes ───────────────────────────────────────────────────────────

export type EventCodes = {
  /** null (with `expiresAt`) only while `tickets` is empty: none issued yet. */
  format: 1 | 2 | null;
  /** Epoch ms on the server clock; the same for every token. */
  expiresAt: number | null;
  stepSeconds: number;
  /** A used ticket has `token: null` and `checkedInAt` set. */
  tickets: {
    id: string;
    type: string | null;
    index: number | null;
    checkedInAt: string | null;
    token: string | null;
  }[];
};

export const eventCodesBody = z
  .object({
    // `lib/bookings/ticket-codes.js` leaves both null when there are no tickets yet.
    format: z.union([z.literal(1), z.literal(2)]).nullable(),
    expires_at: z.number().nullable(),
    step_seconds: z.number(),
    tickets: z.array(
      z.object({
        id: z.string(),
        ticket_type: z.string().nullable(),
        ticket_index: z.number().int().nullable(),
        checked_in_at: z.string().nullable(),
        token: z.string().min(1).nullable(),
      }),
    ),
  })
  .transform((b): EventCodes => ({
    format: b.format,
    expiresAt: b.expires_at,
    stepSeconds: b.step_seconds,
    tickets: b.tickets.map((t) => ({
      id: t.id,
      type: t.ticket_type,
      index: t.ticket_index,
      checkedInAt: t.checked_in_at,
      token: t.token,
    })),
  }));

// ── POST /api/notifications/read-all ─────────────────────────────────────────────────────────────

export const readAllBody = z.object({ updated: count });

// ── Claim (§7a) ──────────────────────────────────────────────────────────────────────────────────

export const claimCountsBody = z.object({
  events: count,
  hotels: count,
  apartments: count,
  total: count,
});
export type ClaimCounts = z.infer<typeof claimCountsBody>;

export const claimCodeSent = z.object({ sent: z.literal(true) });

export const claimRequest = z.object({
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/),
});

export const claimResult = z.object({
  claimed: claimCountsBody,
  // Informational; never fail a claim that happened over them.
  booking_ids: z.object({ events: ids, hotels: ids, apartments: ids }).nullish().catch(null),
  payments: count.nullish().catch(null),
});
export type ClaimResult = z.infer<typeof claimResult>;

// ── Cancel ───────────────────────────────────────────────────────────────────────────────────────

export type CancelResult = {
  /** Event/apartment `refunded`, hotel `refund_initiated`. */
  refunded: boolean;
  /** Hotel only: the payment provider's message. Never shown as-is. */
  refundMessage: string | null;
};

export const cancelBody = z
  .object({
    success: z.literal(true),
    refunded: z.boolean().nullish(),
    refund_initiated: z.boolean().nullish(),
    refund_message: z.string().nullish().catch(null),
  })
  .transform((b): CancelResult => ({
    refunded: b.refunded === true || b.refund_initiated === true,
    refundMessage: b.refund_message ?? null,
  }));

// ── POST /api/refunds/request ────────────────────────────────────────────────────────────────────

export const REFUND_REASON_MAX = 500;

export const refundRequest = z.object({
  booking_id: z.string().min(1),
  reason: z.string().trim().min(1).max(REFUND_REASON_MAX),
});

export const refundResult = z
  .object({ refund_request: z.object({ id: z.string() }) })
  .transform((b) => ({ id: b.refund_request.id }));

// ── POST /api/bookings/event/{id}/transfer ───────────────────────────────────────────────────────

export const transferRequest = z.object({
  new_email: z.string().trim().toLowerCase().pipe(z.email()),
});

export const transferResult = z
  .object({ transferred_to: z.string() })
  .transform((b) => ({ transferredTo: b.transferred_to }));

// ── POST /api/reviews/{listingId} ────────────────────────────────────────────────────────────────

export const REVIEW_COMMENT_MIN = 10;
export const REVIEW_COMMENT_MAX = 1000;

export const reviewRequest = z.object({
  listing_type: z.enum(['hotel', 'apartment', 'event']),
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().min(REVIEW_COMMENT_MIN).max(REVIEW_COMMENT_MAX),
});

export const reviewResult = z
  .object({ data: z.object({ id: z.string() }) })
  .transform((b) => ({ id: b.data.id }));
