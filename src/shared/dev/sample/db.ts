import { EVENTS, PAST_EVENTS, type Row } from './data/events';
import {
  APARTMENT_BOOKINGS,
  EVENT_BOOKINGS,
  HOTEL_BOOKINGS,
  NOTIFICATIONS,
  SAVED,
  USERS,
} from './data/people';
import {
  APARTMENTS,
  BREAKFAST_OPTIONS,
  HOTELS,
  PRICING_RULES,
  ROOM_RATES,
  ROOM_TYPES,
} from './data/stays';

export type { Row };

const hotelOfRoomType = (roomTypeId: unknown) =>
  ROOM_TYPES.find((r) => r.id === roomTypeId)?.hotel_id ?? null;

// In memory, per app run: writes (saves, bookings, read marks) last until the app reloads.
export const tables: Record<string, Row[]> = {
  listings: [...EVENTS, ...PAST_EVENTS].map((e) => ({
    ...e,
    category: 'events',
    visibility: 'public',
  })),
  hotels: HOTELS.map((h) => ({ ...h })),
  hotel_room_types: ROOM_TYPES.map((r) => ({ ...r })),
  hotel_room_rates: ROOM_RATES.map((r) => ({ ...r, hotel_id: hotelOfRoomType(r.room_type_id) })),
  hotel_breakfast_options: BREAKFAST_OPTIONS.map((b) => ({ ...b })),
  serviced_apartments: APARTMENTS.map((a) => ({ ...a })),
  apartment_pricing_rules: PRICING_RULES.map((p) => ({ ...p })),
  users: USERS.map((u) => ({ ...u })),
  event_bookings: EVENT_BOOKINGS.map((b) => ({ ...b })),
  hotel_bookings: HOTEL_BOOKINGS.map((b) => ({ ...b })),
  apartment_bookings: APARTMENT_BOOKINGS.map((b) => ({ ...b })),
  notifications: NOTIFICATIONS.map((n) => ({ ...n })),
  saved_listings: SAVED.map((s) => ({ ...s })),
  hotel_staff: [],
  hotel_rooms: [],
  event_scanners: [],
  vendor_scanners: [],
};

type Filter = (row: Row) => boolean;

const asText = (v: unknown): string =>
  typeof v === 'string'
    ? v
    : typeof v === 'number' || typeof v === 'boolean'
      ? String(v)
      : v === null || v === undefined
        ? 'null'
        : JSON.stringify(v);

function unquote(s: string): string {
  return s.startsWith('"') && s.endsWith('"') ? s.slice(1, -1) : s;
}

// PostgREST filters as supabase-js writes them: `col=eq.v`, `in.("a","b")`, `is.null`, gt/lt…
function filterOf(column: string, expr: string): Filter | null {
  const dot = expr.indexOf('.');
  if (dot < 0) return null;
  const op = expr.slice(0, dot);
  const raw = decodeURIComponent(expr.slice(dot + 1));
  const value = (r: Row) => r[column];
  switch (op) {
    case 'eq':
      return (r) => asText(value(r)) === raw;
    case 'neq':
      return (r) => asText(value(r)) !== raw;
    case 'is':
      return (r) => asText(value(r)) === raw;
    case 'in': {
      const list = raw
        .replace(/^\(|\)$/g, '')
        .split(',')
        .map(unquote);
      return (r) => list.includes(asText(value(r)));
    }
    case 'gt':
      return (r) => asText(value(r)) > raw;
    case 'gte':
      return (r) => asText(value(r)) >= raw;
    case 'lt':
      return (r) => asText(value(r)) < raw;
    case 'lte':
      return (r) => asText(value(r)) <= raw;
    case 'ilike': {
      const needle = raw.replace(/\*/g, '').toLowerCase();
      return (r) => asText(value(r)).toLowerCase().includes(needle);
    }
    default:
      return null;
  }
}

const RESERVED = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

export type Query = { filters: Filter[]; order: [string, boolean][]; limit: number | null };

export function parseQuery(params: URLSearchParams): Query {
  const filters: Filter[] = [];
  params.forEach((v, k) => {
    if (RESERVED.has(k)) return;
    const f = filterOf(k, v);
    if (f !== null) filters.push(f);
  });
  const order = (params.get('order') ?? '')
    .split(',')
    .filter((s) => s.length > 0)
    .map((s): [string, boolean] => {
      const [col = '', dir = 'asc'] = s.split('.');
      return [col, dir === 'desc'];
    });
  const limit = params.get('limit');
  return { filters, order, limit: limit === null ? null : Number(limit) };
}

export function run(rows: readonly Row[], q: Query): Row[] {
  const out = rows.filter((r) => q.filters.every((f) => f(r)));
  for (const [col, desc] of [...q.order].reverse())
    out.sort((a, b) => {
      const x = asText(a[col]);
      const y = asText(b[col]);
      return (x < y ? -1 : x > y ? 1 : 0) * (desc ? -1 : 1);
    });
  return q.limit === null ? out : out.slice(0, q.limit);
}
