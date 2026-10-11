import { z } from 'zod';

export const profileRow = z.object({
  id: z.string(),
  role: z.enum(['customer', 'vendor', 'admin', 'receptionist', 'support']),
  name: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
});

// A staff member may belong to several hotels; the query is limited to one row.
export const hotelStaffRow = z.array(z.object({ hotel_id: z.string() }));
