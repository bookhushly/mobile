import { dayAt } from '@/features/customer/domain/detailText';
import {
  apartmentPriceLabel,
  eventPriceLabel,
  eventStarted,
  hotelPriceLabel,
  ratingLabel,
  type ApartmentPrice,
  type Category,
  type EventPrice,
  type HotelPrice,
  type ListingKind,
} from '@/features/customer/domain/discover';
import type { ApartmentItem, EventItem, HotelItem } from '@/features/customer/schemas/listings';
import { isIsoDate, lagosTime } from '@/shared/lib/lagosDay';

// What a listing card shows (spec §3, D5, D10, D14). Pure: the clock is passed in.

export type CardPrice = HotelPrice | ApartmentPrice | EventPrice;

export type ListingCardModel = {
  kind: ListingKind;
  id: string;
  /** Null when the row has none: the card shows its kind word instead. */
  title: string | null;
  /** "Lekki, Lagos": the place line, or null. */
  area: string | null;
  /** The first https image (D14); null → a wash block. */
  image: string | null;
  /** "4.6 (23)" only when there are reviews (D10); events never have one in 4b. */
  rating: { avg: number; count: number } | null;
  price: CardPrice;
  /**
   * Events only: "Sat 18 Oct · 7:00 pm" (Lagos, 12-hour), "Started" once the start has passed;
   * null when the date is unknown.
   */
  when: string | null;
};

type ItemFor = { hotels: HotelItem; serviced_apartments: ApartmentItem; events: EventItem };

export const KIND_OF: Record<Category, ListingKind> = {
  hotels: 'hotel',
  serviced_apartments: 'apartment',
  events: 'event',
};

/** The first `https://` URL (never http or a data/file URI), else null. */
export function firstHttpsImage(urls: readonly string[] | null): string | null {
  return urls?.find((u) => u.trim().toLowerCase().startsWith('https://'))?.trim() ?? null;
}

/** The distinct, non-empty parts joined: ("Ikeja", "Lagos") → "Ikeja, Lagos". */
export function placeLine(parts: readonly (string | null)[]): string | null {
  const seen: string[] = [];
  for (const p of parts) {
    const t = p?.trim() ?? '';
    if (t !== '' && !seen.some((s) => s.toLowerCase() === t.toLowerCase())) seen.push(t);
  }
  return seen.length > 0 ? seen.join(', ') : null;
}

/**
 * An event's date chip: "Sat 18 Oct · 7:00 pm". `event_date` is a timestamp whose first ten
 * characters are the day; `event_time` a Lagos-meant instant (or, tolerated, a bare "19:00").
 */
export function eventWhenLabel(eventDate: string | null, eventTime: string | null): string | null {
  const day = eventDate?.slice(0, 10) ?? '';
  if (!isIsoDate(day)) return null;
  if (eventTime === null) return dayAt(day, null);
  const instant = lagosTime(eventTime);
  return dayAt(day, instant !== '' ? instant : eventTime);
}

const rated = (avg: number | null, count: number | null) =>
  ratingLabel(avg, count) === null || avg === null || count === null ? null : { avg, count };

const titled = (t: string | null) => (t !== null && t.trim() !== '' ? t.trim() : null);

export function cardOf<C extends Category>(
  cat: C,
  item: ItemFor[C],
  nowMs: number,
): ListingCardModel;
export function cardOf(cat: Category, item: ItemFor[Category], nowMs: number): ListingCardModel {
  const base = {
    kind: KIND_OF[cat],
    id: item.id,
    title: titled(item.title),
    image: firstHttpsImage(item.media_urls),
  };
  if ('area' in item)
    return {
      ...base,
      area: placeLine([item.area, item.city]) ?? item.location,
      rating: rated(item.avg_rating, item.review_count),
      price: apartmentPriceLabel(
        { price_per_night: item.price, price_per_week: null, price_per_month: null },
        [],
      ),
      when: null,
    };
  if ('breakfast_offered' in item)
    return {
      ...base,
      area: placeLine([item.city, item.state]) ?? item.location,
      rating: rated(item.avg_rating, item.review_count),
      price: hotelPriceLabel(item.price),
      when: null,
    };
  return {
    ...base,
    area: placeLine([item.location]),
    rating: null,
    price: eventPriceLabel({ price: item.price, ticket_packages: [] }, nowMs),
    // K4 (the web's rule): once the start has passed, tickets aren't sold.
    when: eventStarted(item, nowMs) ? 'Started' : eventWhenLabel(item.event_date, item.event_time),
  };
}
