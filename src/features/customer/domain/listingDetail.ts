// What the listing detail screen says (spec §3 Listing, D5, D11, D12). Pure: the clock is passed in.
import { eventWhen } from '@/features/customer/domain/detailText';
import {
  effectivePackagePrice,
  packageStock,
  roomTypeFrom,
  type EventStock,
  type ListingKind,
  type PackageLike,
} from '@/features/customer/domain/discover';
import type {
  ApartmentDetail,
  HotelDetail,
  PricingRule,
} from '@/features/customer/schemas/listings';
import { isIsoDate, lagosTime, lagosToday, shortDate, stayRange } from '@/shared/lib/lagosDay';

/** Every distinct `https://` image (D14); http, data and file URIs are never loaded. */
export function httpsImages(urls: readonly string[] | null): string[] {
  const out = (urls ?? [])
    .map((u) => u.trim())
    .filter((u) => u.toLowerCase().startsWith('https://'));
  return [...new Set(out)];
}

/** The lowest "from" price over the room types (D5), or null when none has a price. */
export function hotelFromPrice(
  roomTypes: readonly { id: string; base_price: number | null }[],
  rates: readonly { room_type_id: string; price_per_night: number | null }[],
): number | null {
  const prices = roomTypes
    .map((t) => roomTypeFrom(t, rates))
    .filter((p): p is number => p !== null);
  return prices.length > 0 ? Math.min(...prices) : null;
}

/** "1 king bed, 2 queen beds"; null without beds. */
export function bedsLine(
  beds: readonly { type: string | null; count: number | null }[],
): string | null {
  const parts = beds.map((b) => {
    const n = b.count !== null && b.count >= 1 ? Math.floor(b.count) : 1;
    const kind = (b.type ?? '')
      .trim()
      .toLowerCase()
      .replace(/\s*beds?$/, '');
    const word = `${kind === '' ? '' : `${kind} `}${n === 1 ? 'bed' : 'beds'}`;
    return `${String(n)} ${word}`;
  });
  return parts.length > 0 ? parts.join(', ') : null;
}

type Bed = { type: string | null; count: number | null };

/** The beds of a room type's default rate (else its first rate), as words; null without any. */
export function defaultBeds(
  roomTypeId: string,
  rates: readonly { room_type_id: string; is_default: boolean | null; beds: readonly Bed[] }[],
): string | null {
  const own = rates.filter((r) => r.room_type_id === roomTypeId);
  const rate = own.find((r) => r.is_default === true) ?? own[0];
  return rate === undefined ? null : bedsLine(rate.beds);
}

/** A ticket type's stock word; none once the whole event is ended or off sale (D12). */
export function ticketStockWord(
  pkg: PackageLike,
  threshold: number,
  event: EventStock,
): 'Sold out' | 'Few left' | null {
  if (event === 'ended' || event === 'notOnSale') return null;
  const s = packageStock(pkg, threshold);
  return s === 'soldOut' ? 'Sold out' : s === 'fewLeft' ? 'Few left' : null;
}

/** "13 Oct 2026" (the Lagos day); null when unreadable. */
export function reviewDate(iso: string | null): string | null {
  const ms = iso === null ? NaN : Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  const d = lagosToday(ms);
  return `${shortDate(d).split(' ').slice(1).join(' ')} ${d.slice(0, 4)}`;
}

type EventTimes = {
  event_date: string | null;
  event_end_date: string | null;
  event_time: string | null;
};

const dayOf = (s: string | null): string | null => {
  const d = s?.slice(0, 10) ?? '';
  return isIsoDate(d) ? d : null;
};

/** "Sat 17 Oct", for the footer; null when the date is unreadable. */
export function eventDay(eventDate: string | null): string | null {
  const d = dayOf(eventDate);
  return d === null ? null : shortDate(d);
}

/** "Sat 17 Oct · 7:00 pm" or "Sat 17 Oct – Mon 19 Oct · 7:00 pm" (Lagos, 12-hour). */
export function eventDateLine(e: EventTimes): string | null {
  const start = dayOf(e.event_date);
  if (start === null) return null;
  const end = dayOf(e.event_end_date) ?? start;
  // `event_time` is an instant; a bare "19:00" is tolerated as written.
  const instant = e.event_time === null ? '' : lagosTime(e.event_time);
  return eventWhen(start, end < start ? start : end, instant !== '' ? instant : e.event_time);
}

/** "Early bird until Fri 16 Oct" while the early-bird price applies; else null. */
export function earlyBirdNote(pkg: PackageLike, nowMs: number): string | null {
  const eb = pkg.early_bird_price;
  if (typeof eb !== 'number' || pkg.early_bird_end == null) return null;
  if (effectivePackagePrice(pkg, nowMs) !== eb) return null;
  return `Early bird until ${shortDate(lagosToday(Date.parse(pkg.early_bird_end)))}`;
}

const BLOCKED: Partial<Record<EventStock, string>> = {
  soldOut: 'Sold out',
  ended: 'This event has ended',
  notOnSale: 'Not on sale',
};

/** The footer's action (D11); `blocked` is the reason the button is off (D12). */
export function handoff(
  kind: ListingKind,
  stock: EventStock | null,
): { label: string; blocked: string | null } {
  if (kind !== 'event') return { label: 'Book on bookhushly.com', blocked: null };
  return {
    label: 'Get tickets on bookhushly.com',
    blocked: stock === null ? null : (BLOCKED[stock] ?? null),
  };
}

/** A seasonal price rule as a line: "Christmas · 20 Dec – 2 Jan"; null without a price. */
export function pricingRuleLine(
  rule: PricingRule,
): { id: string; label: string; amount: number } | null {
  const amount = rule.price_per_night;
  if (amount === null || amount <= 0) return null;
  const from = dayOf(rule.start_date);
  const to = dayOf(rule.end_date) ?? from;
  const dates = from === null || to === null ? null : stayRange(from, to);
  const name = rule.label?.trim() ?? '';
  const label = [name === '' ? null : name, dates].filter((s) => s !== null).join(' · ');
  return { id: rule.id, label: label === '' ? 'Some dates' : label, amount };
}

const sentence = (s: string) => {
  const t = s.replace(/_/g, ' ').trim().toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
};
const on = (s: string | null) => {
  const t = s?.trim().toLowerCase() ?? '';
  return t !== '' && !['none', 'false', 'no', '0'].includes(t);
};

/** Breakfast, power and airport transfer, as the web words them. */
export function hotelFacts(h: HotelDetail): string[] {
  const out: string[] = [];
  const breakfast = h.breakfast_offered?.trim().toLowerCase();
  const type = h.breakfast_type?.trim();
  if (breakfast === 'included')
    out.push(type ? `Breakfast included (${type.toLowerCase()})` : 'Breakfast included');
  else if (breakfast === 'paid' || breakfast === 'optional') out.push('Breakfast at extra cost');
  const gen = h.generator_available?.trim().toLowerCase() ?? '';
  const hours = h.generator_hours?.trim();
  if (gen === '24hrs' || gen === '24h') out.push('24-hour generator');
  else if (gen === 'partial') out.push(hours ? `Generator ${hours}` : 'Generator part of the day');
  else if (on(gen)) out.push('Generator available');
  if (on(h.inverter_available)) out.push('Inverter or solar backup');
  if (h.airport_transfer_enabled === true) out.push('Airport transfer available');
  return out;
}

export type Fact = { label: string; value: string };

const count = (n: number | null) => (n !== null && n > 0 ? String(Math.floor(n)) : null);

/** The apartment's key facts (spec §3); unknowns are left out. */
export function apartmentFacts(a: ApartmentDetail): Fact[] {
  const power = [
    a.electricity_included === true ? 'Electricity included' : null,
    a.generator_available === true
      ? a.generator_hours?.trim()
        ? `generator (${a.generator_hours.trim()})`
        : 'generator'
      : null,
    a.inverter_available === true ? 'inverter' : null,
    a.solar_power === true ? 'solar' : null,
  ].filter((s): s is string => s !== null);
  const parking = count(a.parking_spaces);
  const facts: (Fact | null)[] = [
    a.apartment_type?.trim() ? { label: 'Type', value: sentence(a.apartment_type) } : null,
    count(a.bedrooms) === null ? null : { label: 'Bedrooms', value: String(count(a.bedrooms)) },
    count(a.bathrooms) === null ? null : { label: 'Bathrooms', value: String(count(a.bathrooms)) },
    count(a.max_guests) === null
      ? null
      : { label: 'Guests', value: `Up to ${String(count(a.max_guests))}` },
    count(a.square_meters) === null
      ? null
      : { label: 'Size', value: `${String(count(a.square_meters))} m²` },
    a.furnished === null ? null : { label: 'Furnished', value: a.furnished ? 'Yes' : 'No' },
    a.kitchen_equipped === true ? { label: 'Kitchen', value: 'Equipped' } : null,
    parking === null
      ? null
      : { label: 'Parking', value: `${parking} ${parking === '1' ? 'space' : 'spaces'}` },
    power.length > 0 ? { label: 'Power', value: sentence(power.join(', ')) } : null,
    a.water_supply?.trim() ? { label: 'Water', value: sentence(a.water_supply) } : null,
    a.internet_included === true ? { label: 'Internet', value: 'Included' } : null,
  ];
  return facts.filter((f): f is Fact => f !== null);
}
