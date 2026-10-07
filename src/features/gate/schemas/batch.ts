import { z } from 'zod';

const itemResult = z.object({
  client_seq: z.number().int(),
  ok: z.boolean(),
  code: z.string(),
  checked_in_at: z.string().nullable().optional(),
  scanned_by: z.string().nullable().optional(),
  by_me: z.boolean().nullable().optional(),
});
export type BatchItemResult = z.infer<typeof itemResult>;

export const batchBody = z.object({ results: z.array(z.unknown()) });
export type BatchBody = z.infer<typeof batchBody>;

/** Unreadable items are left out; batchSync keeps their outbox rows queued. */
export function batchResults(body: BatchBody): BatchItemResult[] {
  return body.results.flatMap((r) => {
    const p = itemResult.safeParse(r);
    return p.success ? [p.data] : [];
  });
}
