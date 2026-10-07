import { z } from 'zod';

// z.object strips unknown keys: contact_email / contact_phone / sibling tickets never leave here.
// Tolerant on purpose: any 200 with ok: true is an admission, so drifted fields fall back to null.
const nullString = z.string().nullable().catch(null);
const nullInt = z.number().int().nullable().catch(null);
export const admitBody = z.object({
  ok: z.literal(true),
  ticket: z
    .object({
      id: nullString,
      ticket_type: nullString,
      ticket_index: nullInt,
      checked_in_at: nullString,
    })
    .nullable()
    .catch(null),
  booking: z
    .object({
      id: nullString,
      total_tickets: nullInt,
      checked_in_count: nullInt,
    })
    .nullable()
    .catch(null),
});
export type AdmitBody = z.infer<typeof admitBody>;

export const usedBody = z.object({
  code: z.literal('already_checked_in'),
  checked_in_at: z.string().nullable(),
  // coalesce(users.name, users.email) on the server — may be an email.
  scanned_by: z.string().nullable(),
  // Server-side "this scanner admitted it". null = lookup failed; absent before web PR #192 deploys.
  by_me: z.boolean().nullable().optional(),
  ticket: z
    .object({ ticket_type: z.string().nullable(), ticket_index: z.number().int().nullable() })
    .nullable(),
});
export type UsedBody = z.infer<typeof usedBody>;

export const summaryBody = z.object({
  admitted: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  recent: z.array(
    z.object({
      id: z.string(),
      ticket_type: z.string().nullable(),
      checked_in_at: z.string(),
      scanned_by_me: z
        .boolean()
        .nullable()
        .transform((v) => v === true),
    }),
  ),
});
export type ScanSummary = z.infer<typeof summaryBody>;
