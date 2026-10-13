import { z } from 'zod';

import { liveClient, read, type SupabaseLike } from '@/features/customer/api/customerDb';
import {
  APARTMENT_COLUMNS,
  apartmentDetail,
  EVENT_COLUMNS,
  eventDetail,
  HOTEL_COLUMNS,
  hotelDetail,
  PRICING_RULE_COLUMNS,
  pricingRule,
  ROOM_RATE_COLUMNS,
  ROOM_TYPE_COLUMNS,
  roomRate,
  roomType,
  type ApartmentDetail,
  type EventDetail,
  type HotelDetail,
  type PricingRule,
  type RoomRate,
  type RoomType,
} from '@/features/customer/schemas/listings';
import type { ApiError } from '@/shared/lib/errors';
import { ok, type Result } from '@/shared/lib/result';

export type HotelListing = { hotel: HotelDetail; roomTypes: RoomType[]; rates: RoomRate[] };
export type ApartmentListing = { apartment: ApartmentDetail; rules: PricingRule[] };

export type ListingDetailDb = {
  hotel(id: string): Promise<Result<HotelListing | null, ApiError>>;
  apartment(id: string): Promise<Result<ApartmentListing | null, ApiError>>;
  event(id: string): Promise<Result<EventDetail | null, ApiError>>;
};

const maybeHotel = hotelDetail.nullable();
const roomTypes = z.array(roomType);
const rates = z.array(roomRate);
const maybeApartment = apartmentDetail.nullable();
const rules = z.array(pricingRule);
const maybeEvent = eventDetail.nullable();
const ASC = { ascending: true };

// No GET detail route exists (BACKEND_STATUS §7): detail is read under RLS with explicit column
// constants (spec D4), ids only through `.eq`. null = not found or hidden by RLS (e.g. a suspended
// vendor): "This listing isn't available right now". Child reads run in parallel with the parent.
export function createListingDetailDb(client: SupabaseLike): ListingDetailDb {
  return {
    async hotel(id) {
      const [h, t, r] = await Promise.all([
        read(client.from('hotels').select(HOTEL_COLUMNS).eq('id', id).maybeSingle(), maybeHotel),
        read(
          client
            .from('hotel_room_types')
            .select(ROOM_TYPE_COLUMNS)
            .eq('hotel_id', id)
            .order('base_price', ASC),
          roomTypes,
        ),
        read(client.from('hotel_room_rates').select(ROOM_RATE_COLUMNS).eq('hotel_id', id), rates),
      ]);
      if (!h.ok) return h;
      if (h.value === null) return ok(null);
      if (!t.ok) return t;
      if (!r.ok) return r;
      return ok({ hotel: h.value, roomTypes: t.value, rates: r.value });
    },
    async apartment(id) {
      const [a, p] = await Promise.all([
        read(
          client
            .from('serviced_apartments')
            .select(APARTMENT_COLUMNS)
            .eq('id', id)
            .eq('status', 'active')
            .maybeSingle(),
          maybeApartment,
        ),
        read(
          client
            .from('apartment_pricing_rules')
            .select(PRICING_RULE_COLUMNS)
            .eq('apartment_id', id)
            .order('start_date', ASC),
          rules,
        ),
      ]);
      if (!a.ok) return a;
      if (a.value === null) return ok(null);
      if (!p.ok) return p;
      return ok({ apartment: a.value, rules: p.value });
    },
    // `listings` holds every category, and RLS lets a vendor read their own draft/private rows:
    // only public events open here. `active`/`availability` are read, not filtered: an inactive
    // event shows "Not on sale".
    event: (id) =>
      read(
        client
          .from('listings')
          .select(EVENT_COLUMNS)
          .eq('id', id)
          .eq('category', 'events')
          .eq('visibility', 'public')
          .maybeSingle(),
        maybeEvent,
      ),
  };
}

export const listingDetailDb: ListingDetailDb = createListingDetailDb(liveClient);
