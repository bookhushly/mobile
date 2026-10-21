import type { CustomerQuery, SupabaseLike } from '@/features/customer/api/customerDb';
import { createCheckoutDb } from '@/features/customer/api/checkoutDb';

jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

type Res = { data: unknown; error?: { code?: string } | null };
type Log = { table: string; columns: string; calls: unknown[][] };

function fake(responses: Record<string, Res>) {
  const logs: Log[] = [];
  const client: SupabaseLike = {
    from: (table) => ({
      select: (columns) => {
        const log: Log = { table, columns, calls: [] };
        logs.push(log);
        const res = responses[table] ?? { data: null };
        const row = { data: res.data, error: res.error ?? null, status: 200 };
        const q: CustomerQuery = Object.assign(Promise.resolve(row), {
          eq: (c: string, v: string | boolean) => {
            log.calls.push(['eq', c, v]);
            return q;
          },
          order: (c: string, o?: { ascending: boolean }) => {
            log.calls.push(['order', c, o]);
            return q;
          },
          limit: (n: number) => {
            log.calls.push(['limit', n]);
            return q;
          },
          maybeSingle: () => Promise.resolve(row),
        });
        return q;
      },
      update: () => {
        throw new Error('checkout reads never write');
      },
      delete: () => {
        throw new Error('checkout reads never write');
      },
    }),
  };
  return { db: createCheckoutDb(client), logs };
}

describe('checkoutDb.hotelExtras', () => {
  it('hotelExtras drops unavailable breakfast options and non-numeric airport prices', async () => {
    const { db, logs } = fake({
      hotels: {
        data: {
          breakfast_offered: 'paid',
          airport_transfer_enabled: true,
          airport_prices: { lagos: 5000, abuja: 'TBA', ph: '7000', bad: null },
          airport_transfer_fee: '2500',
        },
      },
      hotel_breakfast_options: {
        data: [
          { id: 'b1', name: 'Continental', price_per_person: '3000.00', is_available: true },
          { id: 'b2', name: 'Gone', price_per_person: 1000, is_available: false },
        ],
      },
    });
    expect(await db.hotelExtras('h1')).toEqual({
      breakfastOffered: 'paid',
      breakfast: [{ id: 'b1', name: 'Continental', pricePerPerson: 3000 }],
      airportEnabled: true,
      airportPrices: { lagos: 5000, ph: 7000 },
      airportFee: 2500,
    });
    const h = logs.find((l) => l.table === 'hotels');
    expect(h?.columns).toBe(
      'breakfast_offered, airport_transfer_enabled, airport_prices, airport_transfer_fee',
    );
    expect(logs.find((l) => l.table === 'hotel_breakfast_options')?.calls).toEqual([
      ['eq', 'hotel_id', 'h1'],
      ['eq', 'is_available', true],
    ]);
  });

  it('a failed read throws rather than answering with empty extras', async () => {
    const { db } = fake({ hotels: { data: null, error: { code: '500' } } });
    await expect(db.hotelExtras('h1')).rejects.toThrow();
  });
});

describe('checkoutDb.apartmentExtras', () => {
  it('reads the three columns and defaults the minimum stay to 1', async () => {
    const { db, logs } = fake({
      serviced_apartments: {
        data: { airport_transfer_enabled: null, airport_prices: null, minimum_stay: null },
      },
    });
    expect(await db.apartmentExtras('a1')).toEqual({
      airportEnabled: false,
      airportPrices: {},
      minimumStay: 1,
    });
    expect(logs[0]?.columns).toBe('airport_transfer_enabled, airport_prices, minimum_stay');
  });
});

describe('checkoutDb.eventQuestions', () => {
  it('parses the listing custom_questions, skipping bad items', async () => {
    const { db, logs } = fake({
      listings: {
        data: {
          custom_questions: [{ id: 1, label: 'Diet', type: 'text' }, { nope: true }],
        },
      },
    });
    expect(await db.eventQuestions('l1')).toEqual([
      { id: '1', label: 'Diet', type: 'text', options: [], required: false },
    ]);
    expect(logs[0]?.columns).toBe('custom_questions');
  });

  it('returns [] for a missing listing', async () => {
    const { db } = fake({ listings: { data: null } });
    expect(await db.eventQuestions('l1')).toEqual([]);
  });
});

describe('checkoutDb.findRecentEventBooking', () => {
  it('filters by user, listing, pending and since', async () => {
    const { db, logs } = fake({
      event_bookings: { data: [{ id: 'e1', created_at: '2026-10-21T10:00:00.123+00:00' }] },
    });
    expect(await db.findRecentEventBooking('u1', 'l1', '2026-10-21T09:59:00.000Z')).toEqual({
      id: 'e1',
      created_at: '2026-10-21T10:00:00.123+00:00',
    });
    expect(logs[0]?.columns).toBe('id, created_at');
    expect(logs[0]?.calls).toEqual([
      ['eq', 'customer_id', 'u1'],
      ['eq', 'listing_id', 'l1'],
      ['eq', 'status', 'pending'],
      ['order', 'created_at', { ascending: false }],
      ['limit', 1],
    ]);
  });

  it('is null when the newest pending booking predates since, or none exist', async () => {
    const old = fake({
      event_bookings: { data: [{ id: 'e1', created_at: '2026-10-21T09:00:00+00:00' }] },
    });
    expect(await old.db.findRecentEventBooking('u', 'l', '2026-10-21T09:59:00.000Z')).toBeNull();
    const none = fake({ event_bookings: { data: [] } });
    expect(await none.db.findRecentEventBooking('u', 'l', '2026-10-21T09:59:00.000Z')).toBeNull();
  });
});
