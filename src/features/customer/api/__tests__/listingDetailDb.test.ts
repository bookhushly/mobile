import type { CustomerQuery, SupabaseLike } from '@/features/customer/api/customerDb';
import { createListingDetailDb } from '@/features/customer/api/listingDetailDb';
import {
  APARTMENT_COLUMNS,
  EVENT_COLUMNS,
  HOTEL_COLUMNS,
  PRICING_RULE_COLUMNS,
  ROOM_RATE_COLUMNS,
  ROOM_TYPE_COLUMNS,
} from '@/features/customer/schemas/listings';

jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

type Res = { data: unknown; error?: { code?: string } | null; status?: number };
type Log = { table: string; columns: string; calls: unknown[][] };

// One fake builder per `from()`; responses are keyed by table.
function fake(responses: Record<string, Res>) {
  const logs: Log[] = [];
  const client: SupabaseLike = {
    from: (table) => ({
      select: (columns) => {
        const log: Log = { table, columns, calls: [] };
        logs.push(log);
        const res = responses[table] ?? { data: null };
        const row = { data: res.data, error: res.error ?? null, status: res.status ?? 200 };
        const q: CustomerQuery = Object.assign(Promise.resolve(row), {
          eq: (c: string, v: string | boolean) => {
            log.calls.push(['eq', c, v]);
            return q;
          },
          order: (c: string, opts?: { ascending: boolean }) => {
            log.calls.push(opts === undefined ? ['order', c] : ['order', c, opts]);
            return q;
          },
          limit: (n: number) => {
            log.calls.push(['limit', n]);
            return q;
          },
          maybeSingle: () => {
            log.calls.push(['maybeSingle']);
            return Promise.resolve(row);
          },
        });
        return q;
      },
      update: () => {
        throw new Error('detail never writes');
      },
      delete: () => {
        throw new Error('detail never writes');
      },
    }),
  };
  return { db: createListingDetailDb(client), logs };
}

const byTable = (logs: Log[], t: string) => logs.find((l) => l.table === t);

describe('listingDetailDb.hotel', () => {
  it('reads the hotel, its room types (cheapest first) and its rates with the exact columns', async () => {
    const { db, logs } = fake({
      hotels: { data: { id: 'h1', name: 'Eko' } },
      hotel_room_types: {
        data: [{ id: 'rt1', hotel_id: 'h1', name: 'Deluxe', base_price: 40000 }],
      },
      hotel_room_rates: { data: [{ id: 'r1', room_type_id: 'rt1', price_per_night: 38000 }] },
    });
    const r = await db.hotel('h1');
    expect(byTable(logs, 'hotels')).toEqual({
      table: 'hotels',
      columns: HOTEL_COLUMNS,
      calls: [['eq', 'id', 'h1'], ['maybeSingle']],
    });
    expect(byTable(logs, 'hotel_room_types')).toEqual({
      table: 'hotel_room_types',
      columns: ROOM_TYPE_COLUMNS,
      calls: [
        ['eq', 'hotel_id', 'h1'],
        ['order', 'base_price', { ascending: true }],
      ],
    });
    expect(byTable(logs, 'hotel_room_rates')).toEqual({
      table: 'hotel_room_rates',
      columns: ROOM_RATE_COLUMNS,
      calls: [['eq', 'hotel_id', 'h1']],
    });
    expect(r.ok && r.value?.hotel.name).toBe('Eko');
    expect(r.ok && r.value?.roomTypes.map((t) => t.id)).toEqual(['rt1']);
    expect(r.ok && r.value?.rates.map((t) => t.price_per_night)).toEqual([38000]);
  });

  it('a hidden or missing hotel is null', async () => {
    const { db } = fake({ hotels: { data: null }, hotel_room_types: { data: [] } });
    expect(await db.hotel('h1')).toEqual({ ok: true, value: null });
  });

  it('a failed read is an error, not null', async () => {
    const { db } = fake({
      hotels: { data: { id: 'h1' } },
      hotel_room_types: { data: null, error: { code: 'x' }, status: 503 },
      hotel_room_rates: { data: [] },
    });
    expect(await db.hotel('h1')).toEqual({
      ok: false,
      error: { kind: 'unavailable', status: 503 },
    });
  });
});

describe('listingDetailDb.apartment', () => {
  it('reads an active apartment and its pricing rules by start date', async () => {
    const { db, logs } = fake({
      serviced_apartments: { data: { id: 'a1', name: 'Lekki', status: 'active' } },
      apartment_pricing_rules: {
        data: [{ id: 'p1', label: 'Dec', start_date: '2026-12-01', end_date: '2026-12-31' }],
      },
    });
    const r = await db.apartment('a1');
    expect(byTable(logs, 'serviced_apartments')).toEqual({
      table: 'serviced_apartments',
      columns: APARTMENT_COLUMNS,
      calls: [['eq', 'id', 'a1'], ['eq', 'status', 'active'], ['maybeSingle']],
    });
    expect(byTable(logs, 'apartment_pricing_rules')).toEqual({
      table: 'apartment_pricing_rules',
      columns: PRICING_RULE_COLUMNS,
      calls: [
        ['eq', 'apartment_id', 'a1'],
        ['order', 'start_date', { ascending: true }],
      ],
    });
    expect(r.ok && r.value?.apartment.name).toBe('Lekki');
    expect(r.ok && r.value?.rules).toHaveLength(1);
  });

  it('missing is null', async () => {
    const { db } = fake({
      serviced_apartments: { data: null },
      apartment_pricing_rules: { data: [] },
    });
    expect(await db.apartment('a1')).toEqual({ ok: true, value: null });
  });
});

describe('listingDetailDb.event', () => {
  it('reads one public event listing with the event columns (never another category or a draft)', async () => {
    const { db, logs } = fake({ listings: { data: { id: 'e1', title: 'Show' } } });
    const r = await db.event('e1');
    expect(logs).toEqual([
      {
        table: 'listings',
        columns: EVENT_COLUMNS,
        calls: [
          ['eq', 'id', 'e1'],
          ['eq', 'category', 'events'],
          ['eq', 'visibility', 'public'],
          ['maybeSingle'],
        ],
      },
    ]);
    expect(r.ok && r.value?.title).toBe('Show');
    expect(r.ok && r.value?.ticket_packages).toEqual([]);
  });

  it('missing is null; a row that does not parse is a validation error', async () => {
    expect(await fake({ listings: { data: null } }).db.event('e1')).toEqual({
      ok: true,
      value: null,
    });
    expect(await fake({ listings: { data: { title: 'no id' } } }).db.event('e1')).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
  });
});
