import { z } from 'zod';

// z.object strips unknown keys: contact_email / contact_phone / sibling tickets never leave here.
export const admitBody = z.object({
  ok: z.literal(true),
  ticket: z.object({
    id: z.string(),
    ticket_type: z.string().nullable(),
    ticket_index: z.number().int().nullable(),
    checked_in_at: z.string().nullable(),
  }),
  booking: z.object({
    id: z.string(),
    total_tickets: z.number().int().nullable(),
    checked_in_count: z.number().int().nullable(),
  }),
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
