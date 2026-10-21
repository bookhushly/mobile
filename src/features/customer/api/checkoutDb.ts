import { z } from 'zod';

import { liveClient, read, type SupabaseLike } from '@/features/customer/api/customerDb';
import { parseCustomQuestions, type CustomQuestion } from '@/features/customer/schemas/checkout';
import { numeric } from '@/features/customer/schemas/listings';
import type { Result } from '@/shared/lib/result';

export type HotelExtras = {
  breakfastOffered: string | null;
  breakfast: { id: string; name: string; pricePerPerson: number }[];
  airportEnabled: boolean;
  airportPrices: Record<string, number>;
  airportFee: number | null;
};
export type ApartmentExtras = {
  airportEnabled: boolean;
  airportPrices: Record<string, number>;
  minimumStay: number;
};

export type CheckoutDb = {
  eventQuestions(listingId: string): Promise<CustomQuestion[]>;
  hotelExtras(hotelId: string): Promise<HotelExtras>;
  apartmentExtras(apartmentId: string): Promise<ApartmentExtras>;
  findRecentEventBooking(
    userId: string,
    listingId: string,
    sinceIso: string,
  ): Promise<{ id: string; created_at: string } | null>;
};

// Only the keys the form needs. `listings.custom_questions` is read here on purpose (spec P17);
// the detail column lists leave it out.
const QUESTION_COLUMNS = 'custom_questions';
const HOTEL_EXTRA_COLUMNS =
  'breakfast_offered, airport_transfer_enabled, airport_prices, airport_transfer_fee';
const BREAKFAST_COLUMNS = 'id, name, price_per_person, is_available';
const APARTMENT_EXTRA_COLUMNS = 'airport_transfer_enabled, airport_prices, minimum_stay';
const RECENT_COLUMNS = 'id, created_at';

const questionsRow = z.object({ custom_questions: z.unknown() }).nullable();
// An unusable price (a string like "TBA", null) is dropped, not coerced to 0.
const prices = z
  .record(z.string(), z.unknown())
  .nullable()
  .catch(null)
  .transform((r): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(r ?? {})) {
      const n = numeric.safeParse(v);
      if (n.success && Number.isFinite(n.data)) out[k] = n.data;
    }
    return out;
  });
const hotelRow = z
  .object({
    breakfast_offered: z.string().nullable().catch(null),
    airport_transfer_enabled: z.boolean().nullable().catch(null),
    airport_prices: prices,
    airport_transfer_fee: numeric.nullable().catch(null),
  })
  .nullable();
const breakfastRows = z.array(
  z.object({
    id: z.string(),
    name: z.string(),
    price_per_person: numeric,
    is_available: z.boolean().nullable().catch(null),
  }),
);
const apartmentRow = z
  .object({
    airport_transfer_enabled: z.boolean().nullable().catch(null),
    airport_prices: prices,
    minimum_stay: numeric.nullable().catch(null),
  })
  .nullable();
const recentRows = z.array(z.object({ id: z.string(), created_at: z.string() }));

// A failed read throws: an empty list would let the form skip required questions or extras.
function unwrap<T>(r: Result<T, { kind: string }>): T {
  if (!r.ok) throw new Error(`checkout read failed: ${r.error.kind}`);
  return r.value;
}

export function createCheckoutDb(client: SupabaseLike): CheckoutDb {
  return {
    async eventQuestions(listingId) {
      const row = unwrap(
        await read(
          client.from('listings').select(QUESTION_COLUMNS).eq('id', listingId).maybeSingle(),
          questionsRow,
        ),
      );
      return parseCustomQuestions(row?.custom_questions);
    },
    async hotelExtras(hotelId) {
      const [h, b] = await Promise.all([
        read(
          client.from('hotels').select(HOTEL_EXTRA_COLUMNS).eq('id', hotelId).maybeSingle(),
          hotelRow,
        ),
        read(
          client
            .from('hotel_breakfast_options')
            .select(BREAKFAST_COLUMNS)
            .eq('hotel_id', hotelId)
            .eq('is_available', true),
          breakfastRows,
        ),
      ]);
      const hotel = unwrap(h);
      const options = unwrap(b);
      return {
        breakfastOffered: hotel?.breakfast_offered ?? null,
        breakfast: options
          .filter((o) => o.is_available !== false && Number.isFinite(o.price_per_person))
          .map((o) => ({ id: o.id, name: o.name, pricePerPerson: o.price_per_person })),
        airportEnabled: hotel?.airport_transfer_enabled === true,
        airportPrices: hotel?.airport_prices ?? {},
        airportFee: hotel?.airport_transfer_fee ?? null,
      };
    },
    async apartmentExtras(apartmentId) {
      const row = unwrap(
        await read(
          client
            .from('serviced_apartments')
            .select(APARTMENT_EXTRA_COLUMNS)
            .eq('id', apartmentId)
            .maybeSingle(),
          apartmentRow,
        ),
      );
      return {
        airportEnabled: row?.airport_transfer_enabled === true,
        airportPrices: row?.airport_prices ?? {},
        minimumStay: row?.minimum_stay != null && row.minimum_stay >= 1 ? row.minimum_stay : 1,
      };
    },
    // Newest pending event booking since `sinceIso`: how a create that timed out is recovered.
    async findRecentEventBooking(userId, listingId, sinceIso) {
      const q = client
        .from('event_bookings')
        .select(RECENT_COLUMNS)
        .eq('customer_id', userId)
        .eq('listing_id', listingId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1);
      // `since` is applied here (the query slice has no `gte`): the newest row decides, so it is
      // equivalent. Compared as instants: Postgres and the client format timestamps differently.
      const since = Date.parse(sinceIso);
      const newest = unwrap(await read(q, recentRows))[0];
      return newest !== undefined && Date.parse(newest.created_at) >= since ? newest : null;
    },
  };
}

export const checkoutDb: CheckoutDb = createCheckoutDb(liveClient);
