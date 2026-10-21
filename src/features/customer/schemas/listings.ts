import { z } from 'zod';

import { normalizeAmenities } from '@/features/customer/domain/discover';

// Detail reads (spec D4): explicit columns only. Never `vendor_phone`, `caretaker_*`, `agent_*`,
// `whatsapp_number`, `custom_questions`, `seats_config`, `views_count` or
// `security_deposit_notes` — anyone can read them (BACKEND_STATUS §9 Customer 4b (h)).
// All checked against the prod baseline (2026-10-13).
export const HOTEL_COLUMNS =
  'id, name, description, address, city, state, image_urls, amenities, checkout_policy, policies, check_in_time, check_out_time, breakfast_offered, breakfast_type, generator_available, generator_hours, inverter_available, airport_transfer_enabled, avg_rating, review_count, nihotour_certified';
export const ROOM_TYPE_COLUMNS =
  'id, hotel_id, name, description, max_occupancy, base_price, size_sqm, amenities, image_urls';
export const ROOM_RATE_COLUMNS = 'id, room_type_id, beds, price_per_night, is_default, label';
export const APARTMENT_COLUMNS =
  'id, name, description, address, city, state, area, landmark, image_urls, amenities, apartment_type, bedrooms, bathrooms, max_guests, square_meters, price_per_night, price_per_week, price_per_month, minimum_stay, furnished, kitchen_equipped, parking_spaces, utilities_included, electricity_included, generator_available, generator_hours, inverter_available, solar_power, water_supply, internet_included, security_features, check_in_time, check_out_time, cancellation_policy, house_rules, caution_deposit, status, avg_rating, review_count';
export const PRICING_RULE_COLUMNS = 'id, label, start_date, end_date, price_per_night';
// Security review S1: only the low-stock threshold out of `category_data` (a JSON path), never
// the whole object — it also holds `stream_url`, an online event's private link (§9 4b (l)).
export const EVENT_COLUMNS =
  'id, title, description, price, price_unit, location, media_urls, active, availability, vendor_name, event_date, event_time, event_end_date, total_tickets, remaining_tickets, ticket_packages, low_stock_threshold:category_data->>low_stock_threshold, cancellation_policy';

// Display-only data is tolerant: a missing or odd value becomes null, never a failed listing.
const text = z.string().nullable().catch(null);
const flag = z.boolean().nullable().catch(null);
// `numeric` arrives as a number; a numeric string (or the route's parseFloat) is tolerated.
export const numeric = z.union([
  z.number(),
  z
    .string()
    .regex(/^-?\d+(\.\d+)?$/)
    .transform(Number),
]);
const num = numeric.refine(Number.isFinite).nullable().catch(null);
const urls = z.array(z.string()).nullable().catch(null);
const amenities = z.unknown().default(null).transform(normalizeAmenities);
// `category_data.low_stock_threshold`: a number, or text through `->>`; parsed by the domain.
const threshold = z.union([z.number(), z.string()]).nullable().catch(null);

function thresholdOf(categoryData: unknown): unknown {
  return typeof categoryData === 'object' && categoryData !== null
    ? Reflect.get(categoryData, 'low_stock_threshold')
    : null;
}

// ── List items (GET /api/listings) — only the fields we use; the rest (agent_phone…) is stripped ──

export const hotelItem = z.object({
  id: z.string(),
  title: text,
  location: text,
  // The route sends `min_room_price ?? 0`; 0 shows "See rooms for prices".
  price: numeric.refine(Number.isFinite).catch(0),
  media_urls: urls,
  city: text,
  state: text,
  avg_rating: num,
  review_count: num,
  breakfast_offered: text,
  generator_available: text,
});
export type HotelItem = z.infer<typeof hotelItem>;

export const apartmentItem = z.object({
  id: z.string(),
  title: text,
  location: text,
  price: numeric.refine(Number.isFinite).catch(0),
  media_urls: urls,
  city: text,
  state: text,
  area: text,
  apartment_type: text,
  bedrooms: num,
  bathrooms: num,
  max_guests: num,
  minimum_stay: num,
  avg_rating: num,
  review_count: num,
  furnished: flag,
});
export type ApartmentItem = z.infer<typeof apartmentItem>;

// The route sends the whole `category_data` (incl. `stream_url`); only the threshold is kept, so
// the link never reaches the query cache (security review S1).
export const eventItem = z
  .object({
    id: z.string(),
    title: text,
    location: text,
    price: num,
    media_urls: urls,
    vendor_name: text,
    event_date: text,
    event_time: text,
    category_data: z.unknown().default(null),
  })
  .transform(({ category_data: data, ...item }) => ({
    ...item,
    low_stock_threshold: threshold.parse(thresholdOf(data)),
  }));
export type EventItem = z.infer<typeof eventItem>;

export type ListingsPage<T> = { items: T[]; nextPage?: number; totalCount: number | null };

// One odd row must not blank a whole page: rows that don't parse are dropped.
export function listingsPage<T>(item: z.ZodType<T>): z.ZodType<ListingsPage<T>> {
  return z.object({
    items: z.array(z.unknown()).transform((rows) =>
      rows.flatMap((r) => {
        const p = item.safeParse(r);
        return p.success ? [p.data] : [];
      }),
    ),
    nextPage: z.number().int().nonnegative().optional(),
    totalCount: z.number().nullable(),
  });
}

// ── Detail rows (RLS reads) ──────────────────────────────────────────────────────────────────────

export const hotelDetail = z.object({
  id: z.string(),
  name: text,
  description: text,
  address: text,
  city: text,
  state: text,
  image_urls: urls,
  amenities,
  checkout_policy: text,
  policies: text,
  check_in_time: text,
  check_out_time: text,
  breakfast_offered: text,
  breakfast_type: text,
  // hotels.generator_available / inverter_available are text ('24h', 'partial', …).
  generator_available: text,
  generator_hours: text,
  inverter_available: text,
  airport_transfer_enabled: flag,
  avg_rating: num,
  review_count: num,
  nihotour_certified: flag,
});
export type HotelDetail = z.infer<typeof hotelDetail>;

export const roomType = z.object({
  id: z.string(),
  hotel_id: z.string(),
  name: text,
  description: text,
  max_occupancy: num,
  base_price: num,
  size_sqm: num,
  amenities,
  image_urls: urls,
});
export type RoomType = z.infer<typeof roomType>;

const bed = z.object({ type: z.string().nullable().catch(null), count: num });
type Bed = z.infer<typeof bed>;
const BED_SIZES = ['king', 'queen', 'double', 'single'] as const;
const bedCount = numeric.refine((n) => Number.isInteger(n) && n > 0);

/**
 * `hotel_room_rates.beds` is a count per size, `{king, queen, double, single}` (prod default;
 * contract review K1): sizes with a count, king first. A list of `{type, count}` is read only as
 * a fallback; anything else is no beds.
 */
function bedsOf(v: unknown): Bed[] {
  if (Array.isArray(v)) {
    const rows: unknown[] = v;
    return rows.flatMap((r) => {
      const p = bed.safeParse(r);
      return p.success ? [p.data] : [];
    });
  }
  if (typeof v !== 'object' || v === null) return [];
  return BED_SIZES.flatMap((type) => {
    const p = bedCount.safeParse(Reflect.get(v, type));
    return p.success ? [{ type, count: p.data }] : [];
  });
}
const beds = z.unknown().default(null).transform(bedsOf);

export const roomRate = z.object({
  id: z.string(),
  room_type_id: z.string(),
  beds,
  price_per_night: num,
  is_default: flag,
  label: text,
});
export type RoomRate = z.infer<typeof roomRate>;

export const apartmentDetail = z.object({
  id: z.string(),
  name: text,
  description: text,
  address: text,
  city: text,
  state: text,
  area: text,
  landmark: text,
  image_urls: urls,
  amenities,
  apartment_type: text,
  bedrooms: num,
  bathrooms: num,
  max_guests: num,
  square_meters: num,
  price_per_night: num,
  price_per_week: num,
  price_per_month: num,
  minimum_stay: num,
  furnished: flag,
  kitchen_equipped: flag,
  parking_spaces: num,
  utilities_included: flag,
  electricity_included: flag,
  // serviced_apartments.generator_available / inverter_available are booleans.
  generator_available: flag,
  generator_hours: text,
  inverter_available: flag,
  solar_power: flag,
  water_supply: text,
  internet_included: flag,
  security_features: amenities,
  check_in_time: text,
  check_out_time: text,
  cancellation_policy: text,
  house_rules: text,
  caution_deposit: num,
  status: text,
  avg_rating: num,
  review_count: num,
});
export type ApartmentDetail = z.infer<typeof apartmentDetail>;

export const pricingRule = z.object({
  id: z.string(),
  label: text,
  start_date: text,
  end_date: text,
  price_per_night: num,
});
export type PricingRule = z.infer<typeof pricingRule>;

const optionalNum = numeric.refine(Number.isFinite).nullish();

export const ticketPackage = z.object({
  name: z.string(),
  price: numeric.refine(Number.isFinite),
  total: optionalNum,
  remaining: optionalNum,
  description: z.string().nullish(),
  early_bird_price: optionalNum,
  early_bird_end: z.string().nullish(),
  is_single_tier: z.boolean().nullish(),
  max_per_order: optionalNum,
});
export type TicketPackage = z.infer<typeof ticketPackage>;

export const eventDetail = z.object({
  id: z.string(),
  title: text,
  description: text,
  price: num,
  price_unit: text,
  location: text,
  media_urls: urls,
  active: flag,
  availability: text,
  vendor_name: text,
  event_date: text,
  event_time: text,
  event_end_date: text,
  total_tickets: num,
  remaining_tickets: num,
  // Tier by tier: a malformed tier (the web editor saves a blank price as null) is dropped alone;
  // anything that isn't an array is no packages. Never a failed listing.
  ticket_packages: z
    .unknown()
    .default(null)
    .transform((v) => {
      if (!Array.isArray(v)) return [];
      const tiers: unknown[] = v;
      return tiers.flatMap((t) => {
        const p = ticketPackage.safeParse(t);
        return p.success ? [p.data] : [];
      });
    }),
  low_stock_threshold: threshold,
  cancellation_policy: text,
});
export type EventDetail = z.infer<typeof eventDetail>;
