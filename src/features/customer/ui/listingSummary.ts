import type { ApartmentListing, HotelListing } from '@/features/customer/api/listingDetailDb';
import { joinAddress } from '@/features/customer/domain/detailText';
import {
  apartmentPriceLabel,
  eventIsFree,
  eventPriceLabel,
  eventStock,
  hotelPriceLabel,
  ratingLabel,
  type EventStock,
  type ListingKind,
} from '@/features/customer/domain/discover';
import { placeLine, type CardPrice } from '@/features/customer/domain/listingCard';
import {
  eventDay,
  handoff,
  hotelFromPrice,
  httpsImages,
} from '@/features/customer/domain/listingDetail';
import { plainText } from '@/features/customer/domain/plainText';
import type { EventDetail } from '@/features/customer/schemas/listings';

export type AnyListing = HotelListing | ApartmentListing | EventDetail;

/** What the listing's top and footer show, whatever the kind (spec §3). */
export type ListingSummary = {
  title: string;
  /** "Lekki, Lagos". */
  area: string | null;
  /** The address as written, for Maps; null → no Maps link. */
  mapQuery: string | null;
  images: string[];
  rating: { avg: number; count: number } | null;
  price: CardPrice;
  /** Events: the day, for the footer. */
  when: string | null;
  /** Events: D12; null for stays. */
  stock: EventStock | null;
  action: { label: string; blocked: string | null };
  /** Events: costs nothing (P2: books in the app without payments). Stays: false. */
  free: boolean;
  /** Plain text (never HTML), or null. */
  description: string | null;
  amenities: string[];
};

const KIND_WORD: Record<ListingKind, string> = {
  hotel: 'Hotel',
  apartment: 'Apartment',
  event: 'Event',
};
const titled = (t: string | null, kind: ListingKind) =>
  t !== null && t.trim() !== '' ? t.trim() : KIND_WORD[kind];
const rated = (avg: number | null, count: number | null) =>
  ratingLabel(avg, count) === null || avg === null || count === null ? null : { avg, count };

export function listingSummary(data: AnyListing, nowMs: number): ListingSummary {
  if ('hotel' in data) {
    const h = data.hotel;
    return {
      title: titled(h.name, 'hotel'),
      area: placeLine([h.city, h.state]),
      mapQuery: joinAddress([h.address, h.city, h.state]),
      images: httpsImages(h.image_urls),
      rating: rated(h.avg_rating, h.review_count),
      price: hotelPriceLabel(hotelFromPrice(data.roomTypes, data.rates)),
      when: null,
      stock: null,
      action: handoff('hotel', null),
      free: false,
      description: plainText(h.description),
      amenities: h.amenities,
    };
  }
  if ('apartment' in data) {
    const a = data.apartment;
    return {
      title: titled(a.name, 'apartment'),
      area: placeLine([a.area, a.city]),
      mapQuery: joinAddress([a.address, a.area, a.city, a.state]),
      images: httpsImages(a.image_urls),
      rating: rated(a.avg_rating, a.review_count),
      price: apartmentPriceLabel(a, data.rules),
      when: null,
      stock: null,
      action: handoff('apartment', null),
      free: false,
      description: plainText(a.description),
      amenities: a.amenities,
    };
  }
  const stock = eventStock(data, nowMs);
  return {
    title: titled(data.title, 'event'),
    area: placeLine([data.location]),
    mapQuery: joinAddress([data.location]),
    images: httpsImages(data.media_urls),
    rating: null,
    price: eventPriceLabel(data, nowMs),
    when: eventDay(data.event_date),
    stock,
    action: handoff('event', stock),
    free: eventIsFree(data, nowMs),
    description: plainText(data.description),
    amenities: [],
  };
}
