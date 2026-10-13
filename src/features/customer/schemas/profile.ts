import { z } from 'zod';

// Never `users.*`: the table still has a legacy `password` column. No `role` either.
export const PROFILE_COLUMNS = 'id, email, name, phone, state, address';

export const profileRow = z.object({
  id: z.string(),
  email: z.string(),
  name: z.string(),
  phone: z.string().nullable(),
  state: z.string().nullable(),
  address: z.string().nullable(),
});
export type ProfileRow = z.infer<typeof profileRow>;
