import { z } from 'zod';

// GET /api/tickets/{id}/code (Bearer, holder only). `expires_at` is epoch ms on the server clock.
export const ticketCodeBody = z.object({
  token: z.string().min(1),
  format: z.union([z.literal(1), z.literal(2)]),
  expires_at: z.number(),
  step_seconds: z.number(),
  ticket: z.object({ ticket_type: z.string(), ticket_index: z.number() }),
});
export type TicketCodeBody = z.infer<typeof ticketCodeBody>;
