import { z } from 'zod';

export const profileRow = z.object({
  id: z.string(),
  role: z.enum(['customer', 'vendor', 'admin', 'receptionist', 'support']),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

export const hotelStaffRow = z.object({ hotel_id: z.string() }).nullable();
