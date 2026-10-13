import { z } from 'zod';

import type { BookingKind } from '@/features/customer/domain/myBookings';

// Route params are untrusted strings (or arrays): anything off-shape is "not on your account",
// without a query.
const kindParam = z.enum(['event', 'hotel', 'apartment']);
const idParam = z.uuid();

export function bookingIdParam(raw: unknown): string | null {
  const p = idParam.safeParse(raw);
  return p.success ? p.data : null;
}

export function bookingRefParams(
  kind: unknown,
  id: unknown,
): { kind: BookingKind; id: string } | null {
  const k = kindParam.safeParse(kind);
  const i = bookingIdParam(id);
  return k.success && i !== null ? { kind: k.data, id: i } : null;
}
