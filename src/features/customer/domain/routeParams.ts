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

const INDEX_RE = /^\d{1,3}$/;

/** The ticket pager's starting page (0-based `index` param); anything else is the first. */
export function pagerIndexParam(raw: unknown, total: number): number {
  if (typeof raw !== 'string' || !INDEX_RE.test(raw)) return 0;
  const i = Number(raw);
  return i < total ? i : 0;
}
