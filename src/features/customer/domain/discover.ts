import { isIsoDate, type IsoDate } from '@/shared/lib/lagosDay';
import { NIGERIAN_STATES } from '@/shared/lib/phone';

// Discover rules (Phase 4b, spec D2–D12). Pure: no React, no I/O, time is passed in.

export type Category = 'hotels' | 'serviced_apartments' | 'events';
export type ListingKind = 'hotel' | 'apartment' | 'event';

export type Filters = {
  sort: 'newest' | 'price_asc' | 'price_desc' | 'top_rated';
  priceMin?: number;
  priceMax?: number;
  // Hotels only.
  minRating?: 3 | 4 | 4.5;
  breakfastIncluded?: boolean;
  generator24h?: boolean;
  // Apartments only.
  bedrooms?: 1 | 2 | 3;
  furnished?: boolean;
  generator?: boolean;
  // Events only: 'today', 'weekend' or a picked YYYY-MM-DD.
  eventDate?: 'today' | 'weekend' | PickedDate;
};

/** A picked calendar date, `YYYY-MM-DD` (checked with `isIsoDate` before it is sent). */
export type PickedDate = `${number}-${number}-${number}`;

export type ListingQuery = { q: string; state?: string; city?: string; page: number };
export type ListingParams = { params: Record<string, string>; clientFilter?: 'weekend' };

const SEARCH_MAX = 60;
// The route pastes `search`/`city` into a PostgREST `.or()` (BACKEND_STATUS §9 Customer 4b (c)):
// commas, brackets, wildcards, backslashes and quotes never reach it.
const STRIPPED = /[,()%*\\"'‘’“”]/g;

export function sanitizeSearch(raw: string): string {
  const collapsed = raw.replace(STRIPPED, '').replace(/\s+/g, ' ').trim();
  // Cut by code points: slicing UTF-16 units can split an emoji into a lone surrogate, and
  // encodeURIComponent throws on one.
  return Array.from(collapsed).slice(0, SEARCH_MAX).join('').trim();
}

const wholeNaira = (n: number | undefined): string | null =>
  n !== undefined && Number.isFinite(n) && n >= 1 ? String(Math.floor(n)) : null;

// Never emits `bed_sizes`, `floor` or `avail_checkin`/`avail_checkout`: for hotels they return
// nothing (the route can't read rooms, §9 Customer 4b (a)).
export function buildListingParams(
  cat: Category,
  query: ListingQuery,
  filters: Filters,
  todayLagos: IsoDate,
): ListingParams {
  const params: Record<string, string> = { sort: filters.sort, page: String(query.page) };
  const put = (key: string, value: string | null | undefined) => {
    if (value !== null && value !== undefined && value !== '') params[key] = value;
  };
  put('search', sanitizeSearch(query.q));
  // Contract review K3: events match a place on their `location` text, which says "Abuja", not
  // "FCT", so Abuja is sent as a city for events (stays filter `state` exactly: FCT).
  const where: { state?: string; city?: string } =
    cat === 'events' && query.state === 'FCT' && query.city === undefined
      ? { city: 'Abuja' }
      : query;
  put('state', where.state === undefined ? null : sanitizeSearch(where.state));
  put('city', where.city === undefined ? null : sanitizeSearch(where.city));
  put('price_min', wholeNaira(filters.priceMin));
  put('price_max', wholeNaira(filters.priceMax));

  switch (cat) {
    case 'hotels':
      put('min_rating', filters.minRating === undefined ? null : String(filters.minRating));
      if (filters.breakfastIncluded === true) put('breakfast_offered', 'included');
      if (filters.generator24h === true) put('hotel_has_generator', 'true');
      return { params };
    case 'serviced_apartments':
      put('bedrooms', filters.bedrooms === undefined ? null : String(filters.bedrooms));
      if (filters.furnished === true) put('furnished', 'true');
      if (filters.generator === true) put('generator_available', 'true');
      return { params };
    case 'events': {
      const d = filters.eventDate;
      if (d === 'weekend') return { params, clientFilter: 'weekend' };
      // The route builds `${event_date}T00:00:00Z`, so 'today' goes as the Lagos date.
      if (d === 'today') put('event_date', todayLagos);
      else if (d !== undefined && isIsoDate(d)) put('event_date', d);
      return { params };
    }
  }
}

const DAY_MS = 86_400_000;
const dayMs = (d: IsoDate) => Date.parse(`${d}T00:00:00Z`);

// The event's day and this week's Friday (Lagos dates), or null when either date is unreadable.
function weekendOf(
  eventDate: string | null,
  todayLagos: IsoDate,
): { t: number; friday: number } | null {
  if (eventDate === null) return null;
  const day = eventDate.slice(0, 10);
  if (!isIsoDate(day) || !isIsoDate(todayLagos)) return null;
  const today = dayMs(todayLagos);
  const weekday = new Date(today).getUTCDay(); // 0 Sun … 6 Sat
  return { t: dayMs(day), friday: today + (weekday === 0 ? -2 : 5 - weekday) * DAY_MS };
}

/** True when the event's date falls on Friday–Sunday of the current week (Lagos dates). */
export function inThisWeekend(eventDate: string | null, todayLagos: IsoDate): boolean {
  const w = weekendOf(eventDate, todayLagos);
  return w !== null && w.t >= w.friday && w.t <= w.friday + 2 * DAY_MS;
}

/** True when the event's date is after this week's Sunday (Lagos dates). */
export function afterThisWeekend(eventDate: string | null, todayLagos: IsoDate): boolean {
  const w = weekendOf(eventDate, todayLagos);
  return w !== null && w.t > w.friday + 2 * DAY_MS;
}

export function filterCount(cat: Category, f: Filters): number {
  const on = (b: boolean | undefined) => (b === true ? 1 : 0);
  const set = (v: unknown) => (v === undefined ? 0 : 1);
  // The sort isn't a filter: the Sort chip shows it, and it never narrows the list. The price
  // range is one filter (one group in the sheet).
  const shared = wholeNaira(f.priceMin) !== null || wholeNaira(f.priceMax) !== null ? 1 : 0;
  switch (cat) {
    case 'hotels':
      return shared + set(f.minRating) + on(f.breakfastIncluded) + on(f.generator24h);
    case 'serviced_apartments':
      return shared + set(f.bedrooms) + on(f.furnished) + on(f.generator);
    case 'events':
      return shared + set(f.eventDate);
  }
}

export type Place = { label: string; state?: string; city?: string };

export const POPULAR_PLACES: readonly Place[] = [
  { label: 'Lagos', state: 'Lagos' },
  { label: 'Abuja', state: 'FCT' },
  { label: 'Port Harcourt', city: 'Port Harcourt' },
  { label: 'Ibadan', city: 'Ibadan' },
  { label: 'Enugu', state: 'Enugu' },
  { label: 'Kano', state: 'Kano' },
  { label: 'Uyo', city: 'Uyo' },
  { label: 'Calabar', city: 'Calabar' },
];

const LAGOS: Place = { label: 'Lagos', state: 'Lagos' };

/** Explore's default place (spec D6): the profile's state as a place, else Lagos. */
export function placeForState(state: string | null): Place {
  const s = state?.trim() ?? '';
  if (!NIGERIAN_STATES.includes(s)) return LAGOS;
  return (
    POPULAR_PLACES.find((p) => p.state === s && p.city === undefined) ?? { label: s, state: s }
  );
}

/** A stored place, only when it is one the app offers (a popular place or a state); else null. */
export function knownPlace(value: unknown): Place | null {
  if (typeof value !== 'object' || value === null) return null;
  const label: unknown = Reflect.get(value, 'label');
  const state: unknown = Reflect.get(value, 'state');
  const city: unknown = Reflect.get(value, 'city');
  const popular = POPULAR_PLACES.find(
    (p) => p.label === label && p.state === state && p.city === city,
  );
  if (popular !== undefined) return popular;
  if (city !== undefined || typeof state !== 'string' || label !== state) return null;
  return NIGERIAN_STATES.includes(state) ? { label: state, state } : null;
}

// ── Prices (display only; the web recomputes at booking) ────────────────────────────────────────

export type TextPrice = { text: string };
export type HotelPrice = { amount: number; unit: 'night'; prefix: 'From' } | TextPrice;
export type ApartmentPrice =
  { amount: number; unit: 'night'; week?: number; month?: number; varies: boolean } | TextPrice;
/** null: nothing to show (no packages, no price). `{min, max}`: tiers at different prices. */
export type EventPrice = { amount: number } | { min: number; max: number } | TextPrice | null;

const positive = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n) && n > 0;

/** A hotel's list price of 0 means "no rooms readable" (§9 (a)), never ₦0 or Free. */
export function hotelPriceLabel(price: number | null): HotelPrice {
  return positive(price)
    ? { amount: price, unit: 'night', prefix: 'From' }
    : { text: 'See rooms for prices' };
}

export function roomTypeFrom(
  roomType: { id: string; base_price: number | null },
  rates: readonly { room_type_id: string; price_per_night: number | null }[],
): number | null {
  const prices = rates
    .filter((r) => r.room_type_id === roomType.id)
    .map((r) => r.price_per_night)
    .concat(roomType.base_price)
    .filter(positive);
  return prices.length > 0 ? Math.min(...prices) : null;
}

export function apartmentPriceLabel(
  apt: {
    price_per_night: number | null;
    price_per_week: number | null;
    price_per_month: number | null;
  },
  rules: readonly unknown[],
): ApartmentPrice {
  if (!positive(apt.price_per_night)) return { text: 'See prices on bookhushly.com' };
  return {
    amount: apt.price_per_night,
    unit: 'night',
    ...(positive(apt.price_per_week) ? { week: apt.price_per_week } : {}),
    ...(positive(apt.price_per_month) ? { month: apt.price_per_month } : {}),
    varies: rules.length > 0,
  };
}

export type PackageLike = {
  name?: string;
  price: number;
  total?: number | null;
  remaining?: number | null;
  early_bird_price?: number | null;
  early_bird_end?: string | null;
  is_single_tier?: boolean | null;
};

/**
 * The ticket types to show. A "Single Price" event carries one implicit tier only for data
 * consistency (`is_single_tier`); the web shows it as a plain price, so it has no tiers here.
 */
export function ticketTiers<P extends PackageLike>(pkgs: readonly P[]): readonly P[] {
  return pkgs.length === 1 && pkgs[0]?.is_single_tier === true ? [] : pkgs;
}

// K4: an early bird applies only with a price above 0 (the web's `&& pkg.early_bird_price`).
export function effectivePackagePrice(pkg: PackageLike, nowMs: number): number {
  const end = pkg.early_bird_end == null ? NaN : Date.parse(pkg.early_bird_end);
  return positive(pkg.early_bird_price) && end > nowMs ? pkg.early_bird_price : pkg.price;
}

// The web's rule: "Free" only when every tier is 0; otherwise the range of effective prices
// ("₦5,000 – ₦25,000", a 0 tier reading "Free – ₦5,000"); one price when they are all the same.
// A single-tier event shows the listing's price.
export function eventPriceLabel(
  event: { price: number | null; ticket_packages: readonly PackageLike[] },
  nowMs: number,
): EventPrice {
  const pkgs = ticketTiers(event.ticket_packages);
  if (pkgs.length > 0) {
    const prices = pkgs.map((p) => Math.max(0, effectivePackagePrice(p, nowMs)));
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    if (max <= 0) return { text: 'Free' };
    return min === max ? { amount: min } : { min, max };
  }
  if (event.price === null) return null;
  return positive(event.price) ? { amount: event.price } : { text: 'Free' };
}

/**
 * Whether the event costs nothing right now: every tier's effective price is 0 (the "Free" label's
 * rule), or a tierless event's price is 0. An unknown price is never free. P2: a free event books
 * in the app without payments.
 */
export function eventIsFree(
  event: { price: number | null; ticket_packages: readonly PackageLike[] },
  nowMs: number,
): boolean {
  const pkgs = ticketTiers(event.ticket_packages);
  if (pkgs.length > 0) return pkgs.every((p) => effectivePackagePrice(p, nowMs) <= 0);
  return event.price !== null && !positive(event.price);
}

// ── Event stock (D12, the web's wording) ─────────────────────────────────────────────────────────

export type EventStock =
  'started' | 'notOnSale' | 'soldOut' | 'almostSoldOut' | 'fewLeft' | 'onSale';
export type PackageStock = 'soldOut' | 'fewLeft' | 'onSale';

export type StockEvent = {
  event_date: string | null;
  event_end_date: string | null;
  event_time: string | null;
  active: boolean | null;
  availability: string | null;
  ticket_packages: readonly PackageLike[];
  remaining_tickets: number | null;
  total_tickets: number | null;
  /** `category_data.low_stock_threshold` (number or text), as read. */
  low_stock_threshold: unknown;
};

const DEFAULT_LOW_STOCK = 50;

export function lowStockThreshold(raw: unknown): number {
  const n = typeof raw === 'string' ? parseInt(raw, 10) : raw;
  return typeof n === 'number' && Number.isFinite(n) && n > 0 ? n : DEFAULT_LOW_STOCK;
}

// The web reads a missing package count as 0 (`parseInt(p.remaining) || 0`); so do we.
const left = (p: PackageLike) => p.remaining ?? 0;

function lowStock(remaining: number, threshold: number): 'almostSoldOut' | 'fewLeft' | null {
  if (remaining <= Math.ceil(threshold * 0.3)) return 'almostSoldOut';
  if (remaining <= threshold) return 'fewLeft';
  return null;
}

// A timestamp without a zone (`event_date` is "2026-10-17T00:00:00") is Lagos time (UTC+1, no DST).
const ZONED = /(Z|[+-]\d{2}:?\d{2})$/i;
function instantMs(s: string): number {
  const t = s.trim();
  return Date.parse(t.length > 10 && !ZONED.test(t) ? `${t}+01:00` : t);
}

/**
 * The web's rule (contract review K4): once the start (`event_time`, else `event_date`) has
 * passed, the event has started and tickets aren't sold. An unreadable start never blocks.
 */
export function eventStarted(
  event: { event_date: string | null; event_time: string | null },
  nowMs: number,
): boolean {
  const src = event.event_time ?? event.event_date;
  if (src === null) return false;
  const start = instantMs(src);
  return Number.isFinite(start) && start <= nowMs;
}

export function eventStock(event: StockEvent, nowMs: number): EventStock {
  if (eventStarted(event, nowMs)) return 'started';
  if (event.active === false || event.availability !== 'available') return 'notOnSale';
  const threshold = lowStockThreshold(event.low_stock_threshold);
  // A single-tier event's stock is the listing's counts (its tier is only for data consistency).
  const pkgs = ticketTiers(event.ticket_packages);
  let remaining: number | null;
  if (pkgs.length > 0) {
    if (pkgs.every((p) => left(p) === 0)) return 'soldOut';
    remaining = pkgs.reduce((sum, p) => sum + left(p), 0);
  } else {
    remaining = event.remaining_tickets;
    if (remaining === 0 && (event.total_tickets ?? 0) > 0) return 'soldOut';
    if (remaining === 0) return 'onSale'; // no counts kept for this event
  }
  return (remaining === null ? null : lowStock(remaining, threshold)) ?? 'onSale';
}

export function packageStock(pkg: PackageLike, threshold = DEFAULT_LOW_STOCK): PackageStock {
  const n = left(pkg);
  if (n === 0) return 'soldOut';
  return n <= threshold ? 'fewLeft' : 'onSale';
}

// ── Labels and links ─────────────────────────────────────────────────────────────────────────────

export function ratingLabel(avg: number | null, count: number | null): string | null {
  if (count === null || count <= 0 || !positive(avg)) return null;
  return `${avg.toFixed(1)} (${String(count)})`;
}

const WEB = 'https://bookhushly.com';

export function webListingUrl(kind: ListingKind, id: string): string {
  const safe = encodeURIComponent(id);
  switch (kind) {
    case 'hotel':
      return `${WEB}/services/hotels/${safe}`;
    case 'apartment':
      return `${WEB}/services/serviced-apartments/${safe}`;
    case 'event':
      return `${WEB}/services/${safe}`;
  }
}

const sentence = (key: string) => {
  const s = key.replace(/_/g, ' ').trim().toLowerCase();
  return s.charAt(0).toUpperCase() + s.slice(1);
};

const strings = (list: readonly unknown[]) =>
  list.flatMap((v) => (typeof v === 'string' && v.trim() !== '' ? [v.trim()] : []));

/** `{items: [...]}`, a string array, or `{key: true}` → labels; anything else → []. */
export function normalizeAmenities(value: unknown): string[] {
  let out: string[] = [];
  if (Array.isArray(value)) {
    out = strings(value);
  } else if (typeof value === 'object' && value !== null) {
    const items: unknown = Reflect.get(value, 'items');
    if (Array.isArray(items)) out = strings(items);
    else
      out = Object.entries(value).flatMap(([k, v]) =>
        v === true && k.trim() !== '' ? [sentence(k)] : [],
      );
  }
  return [...new Set(out)];
}
