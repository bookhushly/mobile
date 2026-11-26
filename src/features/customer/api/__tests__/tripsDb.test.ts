import { createTripsDb, type TripsClient } from '@/features/customer/api/tripsDb';
import { EMPTY_TRIP, type Trip } from '@/features/customer/domain/trips/trips';

jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

type Call = { table: string; op: string; values?: unknown; filters: [string, string, string][] };
type Answer = { data: unknown; error: { code?: string } | null };

/** Answers each call in order; records what was asked. */
function fake(answers: Answer[]) {
  const calls: Call[] = [];
  const next = () =>
    Promise.resolve({ status: 200, ...(answers.shift() ?? { data: [], error: null }) });
  const query = (c: Call) => {
    const q = Object.assign(next(), {
      eq: (k: string, v: string) => (c.filters.push(['eq', k, v]), q),
      neq: (k: string, v: string) => (c.filters.push(['neq', k, v]), q),
      order: () => q,
      maybeSingle: () => q,
    });
    return q;
  };
  const client: TripsClient = {
    from(table) {
      return {
        select(columns) {
          const c: Call = { table, op: `select ${columns.split(',')[0] ?? ''}`, filters: [] };
          calls.push(c);
          return query(c);
        },
        insert(values) {
          const c: Call = { table, op: 'insert', values, filters: [] };
          calls.push(c);
          return { select: () => next() };
        },
        update(values) {
          const c: Call = { table, op: 'update', values, filters: [] };
          calls.push(c);
          const f = {
            eq: (k: string, v: string) => (c.filters.push(['eq', k, v]), f),
            select: () => next(),
          };
          return f;
        },
      };
    },
  };
  return { db: createTripsDb(client), calls };
}

const row = {
  id: 't1',
  name: 'Lagos trip',
  destination: 'Lagos',
  start_date: '2026-12-18',
  end_date: null,
  status: 'planning',
  notes: null,
  created_at: '2026-11-26T10:00:00Z',
  trip_services: [
    { id: 's2', service_type: 'car_rental', status: 'planned' },
    { id: 's1', service_type: 'hotel', status: 'booked' },
    { id: 's3', service_type: 'tour', status: 'planned' },
  ],
};

describe('tripsDb', () => {
  it('lists the customer’s open trips, services in the usual order, unknown kinds left out', async () => {
    const { db, calls } = fake([{ data: [row], error: null }]);
    const r = await db.list('u1');
    expect(calls[0]?.filters).toEqual([
      ['eq', 'user_id', 'u1'],
      ['neq', 'status', 'cancelled'],
    ]);
    expect(r.ok && r.value[0]?.services.map((s) => s.type)).toEqual(['hotel', 'car_rental']);
  });

  it('creates the trip with its own id, then one planned row per service', async () => {
    const { db, calls } = fake([
      { data: [{ id: 't9' }], error: null },
      { data: [], error: null },
      { data: [{ id: 'a' }, { id: 'b' }], error: null },
    ]);
    const r = await db.create('u1', 't9', {
      ...EMPTY_TRIP,
      destination: 'Lagos',
      services: ['hotel', 'event'],
      name: '  Lagos trip  ',
      notes: ' ',
    });
    expect(r).toEqual({ ok: true, value: 't9' });
    expect(calls[0]?.values).toMatchObject({
      id: 't9',
      user_id: 'u1',
      name: 'Lagos trip',
      notes: null,
      services_needed: ['hotel', 'event'],
    });
    expect(calls[2]?.values).toEqual([
      { trip_id: 't9', service_type: 'hotel', status: 'planned' },
      { trip_id: 't9', service_type: 'event', status: 'planned' },
    ]);
  });

  it('a retry after a lost answer finds the trip there and adds only missing services', async () => {
    const { db, calls } = fake([
      { data: null, error: { code: '23505' } },
      { data: [{ service_type: 'hotel' }], error: null },
      { data: [{ id: 'b' }], error: null },
    ]);
    const r = await db.create('u1', 't9', {
      ...EMPTY_TRIP,
      services: ['hotel', 'event'],
      name: 'x',
    });
    expect(r).toEqual({ ok: true, value: 't9' });
    expect(calls[2]?.values).toEqual([{ trip_id: 't9', service_type: 'event', status: 'planned' }]);
  });

  it('a failed services write is reported, so the retry can finish it', async () => {
    const { db } = fake([
      { data: [{ id: 't9' }], error: null },
      { data: [], error: null },
      { data: null, error: { code: 'x' } },
    ]);
    expect(
      (await db.create('u1', 't9', { ...EMPTY_TRIP, services: ['hotel'], name: 'x' })).ok,
    ).toBe(false);
  });

  it('archiving a trip RLS can’t see (a stale session) is "sign in again", not done', async () => {
    const { db } = fake([{ data: [], error: null }]);
    expect(await db.setStatus('u1', 't1', 'cancelled')).toEqual({
      ok: false,
      error: { kind: 'auth' },
    });
  });

  it('adding a service keeps services_needed in step; one already there adds nothing', async () => {
    const trip: Trip = {
      id: 't1',
      name: 'x',
      destination: null,
      startDate: null,
      endDate: null,
      status: 'planning',
      notes: null,
      createdAt: '',
      services: [{ id: 's1', type: 'hotel', status: 'planned' }],
    };
    const { db, calls } = fake([
      { data: [{ service_type: 'hotel' }], error: null },
      { data: [{ id: 's2' }], error: null },
      { data: [{ id: 't1' }], error: null },
    ]);
    expect((await db.addService(trip, 'security')).ok).toBe(true);
    expect(calls[2]?.values).toEqual({ services_needed: ['hotel', 'security'] });
    // Already on the trip (a double tap, or a retry): nothing is inserted.
    const again = fake([{ data: [{ service_type: 'hotel' }], error: null }]);
    expect((await again.db.addService(trip, 'hotel')).ok).toBe(true);
    expect(again.calls.some((c) => c.op === 'insert')).toBe(false);
  });
});
