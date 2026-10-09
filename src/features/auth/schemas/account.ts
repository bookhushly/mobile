import { z } from 'zod';

// Response shapes for the native auth routes (native-auth-contract.md §1.1–1.5).
export const signUpOk = z.object({
  ok: z.literal(true),
  user: z.object({ id: z.string(), email: z.string() }),
});
export const acceptedOk = z.object({ ok: z.literal(true) });

// Error bodies: `{ error, code, ...extra }`. Each parser reads only what its caller needs.
export const fieldsBody = z.object({ fields: z.record(z.string(), z.string()).optional() });
export const blockersBody = z.object({
  blockers: z.array(z.object({ code: z.string(), detail: z.string() })).optional(),
  detail: z.string().optional(),
  code: z.string().optional(),
});
export const messageBody = z.object({ error: z.string().optional() });
