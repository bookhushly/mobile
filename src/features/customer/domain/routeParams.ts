import { z } from 'zod';

import {
  sanitizeSearch,
  type Category,
  type ListingKind,
} from '@/features/customer/domain/discover';
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

const listingKindParam = z.enum(['hotel', 'apartment', 'event']);
const categoryEnum = z.enum(['hotels', 'serviced_apartments', 'events']);

/** A listing link (`/listing/[kind]/[id]`); anything off-shape is "isn't available", no query. */
export function listingRefParams(
  kind: unknown,
  id: unknown,
): { kind: ListingKind; id: string } | null {
  const k = listingKindParam.safeParse(kind);
  const i = idParam.safeParse(id);
  return k.success && i.success ? { kind: k.data, id: i.data } : null;
}

export function categoryParam(raw: unknown): Category | null {
  const c = categoryEnum.safeParse(raw);
  return c.success ? c.data : null;
}

export type ResultsQuery = { category: Category; q: string; state?: string; city?: string };

const textParam = (raw: unknown): string => (typeof raw === 'string' ? sanitizeSearch(raw) : '');

/**
 * `/results?category=&q=&region=&city=`: untrusted strings, sanitised like typed search text. The
 * state travels as `region`: React Navigation reserves a `state` param for nested navigators.
 */
export function resultsParams(p: {
  category?: unknown;
  q?: unknown;
  region?: unknown;
  city?: unknown;
}): ResultsQuery {
  const out: ResultsQuery = { category: categoryParam(p.category) ?? 'hotels', q: textParam(p.q) };
  const state = textParam(p.region);
  const city = textParam(p.city);
  if (state !== '') out.state = state;
  if (city !== '') out.city = city;
  return out;
}

/** `/search?category=&q=`: the category (null → the screen's default) and the text, sanitised. */
export function searchParams(p: { category?: unknown; q?: unknown }): {
  category: Category | null;
  q: string;
} {
  return { category: categoryParam(p.category), q: textParam(p.q) };
}
