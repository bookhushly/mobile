import {
  createCustomerDb,
  type CustomerQuery,
  type CustomerWrite,
  type SupabaseLike,
  withSessionRetry,
} from '@/features/customer/api/customerDb';
import {
  APARTMENT_BOOKING_COLUMNS,
  EVENT_BOOKING_COLUMNS,
  HOTEL_BOOKING_COLUMNS,
} from '@/features/customer/schemas/bookings';
import { NOTIFICATION_COLUMNS } from '@/features/customer/schemas/notifications';
import { PROFILE_COLUMNS } from '@/features/customer/schemas/profile';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

// The default instance binds the native client; these tests only use createCustomerDb with a fake.
jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

type Call = [string, ...unknown[]];
type Res = { data: unknown; error?: { code?: string } | null; status?: number };

function fake(res: Res) {
  const calls: Call[] = [];
  const state: { table: string; op: string; arg: unknown } = { table: '', op: '', arg: undefined };
  const row = { data: res.data, error: res.error ?? null, status: res.status ?? 200 };
  const q: CustomerQuery = Object.assign(Promise.resolve(row), {
    eq: (c: string, v: string | boolean) => {
      calls.push(['eq', c, v]);
      return q;
    },
    order: (c: string, opts?: { ascending: boolean }) => {
      calls.push(opts === undefined ? ['order', c] : ['order', c, opts]);
      return q;
    },
    limit: (n: number) => {
      calls.push(['limit', n]);
      return q;
    },
    maybeSingle: () => {
      calls.push(['maybeSingle']);
      return Promise.resolve(row);
    },
  });
  const w: CustomerWrite = {
    eq: (c: string, v: string | boolean) => {
      calls.push(['eq', c, v]);
      return w;
    },
    in: (c: string, v: readonly string[]) => {
      calls.push(['in', c, v]);
      return w;
    },
    select: (c: 'id') => {
      calls.push(['select', c]);
      return Promise.resolve(row);
    },
  };
  const client: SupabaseLike = {
    from: (table) => {
      state.table = table;
      return {
        select: (columns) => {
          state.op = 'select';
          state.arg = columns;
          return q;
        },
        update: (values) => {
          state.op = 'update';
          state.arg = values;
          return w;
        },
        delete: () => {
          state.op = 'delete';
          return w;
        },
      };
    },
  };
  return { db: createCustomerDb(client), calls, state };
}

const NEWEST_50: Call[] = [
  ['order', 'created_at', { ascending: false }],
  ['limit', 50],
];

const event = {
  id: 'e1',
  status: 'confirmed',
  payment_status: 'completed',
  booking_date: '2026-10-18',
  booking_time: null,
  guests: 1,
  ticket_details: null,
  seat_assignments: null,
  created_at: '2026-10-01T10:00:00Z',
  listing: null,
  tickets: [],
};
const hotel = {
  id: 'h1',
  check_in_date: '2026-10-18',
  check_out_date: '2026-10-19',
  adults: 1,
  children: 0,
  payment_status: 'completed',
  booking_status: 'confirmed',
  checked_in: false,
  checked_in_at: null,
  checked_out_at: null,
  check_in_code: 'ABCD1234',
  created_at: '2026-10-01T10:00:00Z',
  hotel: null,
  room_type: null,
};
const apartment = {
  id: 'a1',
  check_in_date: '2026-10-18',
  check_out_date: '2026-10-19',
  number_of_nights: 1,
  number_of_guests: 2,
  payment_status: 'paid',
  booking_status: 'confirmed',
  checked_in_at: null,
  checked_out_at: null,
  created_at: '2026-10-01T10:00:00Z',
  apartment: null,
};
const notification = {
  id: 'n1',
  type: 'booking',
  title: 'Booked',
  message: 'See you there',
  data: { bookingId: 'e1' },
  link: '/dashboard/customer',
  read: false,
  created_at: '2026-10-01T10:00:00Z',
};
const profile = {
  id: 'u1',
  email: 'ada@example.com',
  name: 'Ada',
  phone: null,
  state: 'Lagos',
  address: null,
};

describe('select strings', () => {
  it('never read users.*, role or a password', () => {
    expect(PROFILE_COLUMNS).not.toContain('*');
    for (const banned of ['role', 'password']) expect(PROFILE_COLUMNS).not.toContain(banned);
  });
  it.each([EVENT_BOOKING_COLUMNS, HOTEL_BOOKING_COLUMNS, APARTMENT_BOOKING_COLUMNS])(
    'booking lists read no contact details or money: %s',
    (s) => {
      for (const banned of ['email', 'phone', 'amount', 'total', 'price']) {
        expect(s).not.toContain(banned);
      }
    },
  );
});

describe('booking lists', () => {
  it('events by customer_id, newest 50', async () => {
    const f = fake({ data: [event] });
    const r = await f.db.events('u1');
    expect(f.state).toEqual({ table: 'event_bookings', op: 'select', arg: EVENT_BOOKING_COLUMNS });
    expect(f.calls).toEqual([['eq', 'customer_id', 'u1'], ...NEWEST_50]);
    expect(r).toEqual({ ok: true, value: [event] });
  });
  it('hotels by customer_id, newest 50', async () => {
    const f = fake({ data: [hotel] });
    const r = await f.db.hotels('u1');
    expect(f.state).toEqual({ table: 'hotel_bookings', op: 'select', arg: HOTEL_BOOKING_COLUMNS });
    expect(f.calls).toEqual([['eq', 'customer_id', 'u1'], ...NEWEST_50]);
    expect(r.ok).toBe(true);
  });
  it('apartments by user_id, newest 50', async () => {
    const f = fake({ data: [apartment] });
    const r = await f.db.apartments('u1');
    expect(f.state).toEqual({
      table: 'apartment_bookings',
      op: 'select',
      arg: APARTMENT_BOOKING_COLUMNS,
    });
    expect(f.calls).toEqual([['eq', 'user_id', 'u1'], ...NEWEST_50]);
    expect(r.ok).toBe(true);
  });
  it('a row failing the schema is a validation error', async () => {
    const f = fake({ data: [{ ...event, booking_date: 'soon' }] });
    expect(await f.db.events('u1')).toEqual({ ok: false, error: { kind: 'validation' } });
  });
  it('a 503 is unavailable, never a business answer', async () => {
    const f = fake({ data: null, error: { code: 'PGRST000' }, status: 503 });
    expect(await f.db.hotels('u1')).toEqual({
      ok: false,
      error: { kind: 'unavailable', status: 503 },
    });
  });
});

describe('single bookings', () => {
  it('event by owner and id', async () => {
    const f = fake({ data: event });
    const r = await f.db.event('u1', 'e1');
    expect(f.state.table).toBe('event_bookings');
    expect(f.calls).toEqual([['eq', 'customer_id', 'u1'], ['eq', 'id', 'e1'], ['maybeSingle']]);
    expect(r).toEqual({ ok: true, value: event });
  });
  it('hotel by owner and id', async () => {
    const f = fake({ data: hotel });
    await f.db.hotel('u1', 'h1');
    expect(f.state).toEqual({ table: 'hotel_bookings', op: 'select', arg: HOTEL_BOOKING_COLUMNS });
    expect(f.calls).toEqual([['eq', 'customer_id', 'u1'], ['eq', 'id', 'h1'], ['maybeSingle']]);
  });
  it('apartment by user_id and id', async () => {
    const f = fake({ data: apartment });
    await f.db.apartment('u1', 'a1');
    expect(f.state.table).toBe('apartment_bookings');
    expect(f.calls).toEqual([['eq', 'user_id', 'u1'], ['eq', 'id', 'a1'], ['maybeSingle']]);
  });
  it('no match is ok(null)', async () => {
    const f = fake({ data: null });
    expect(await f.db.apartment('u1', 'x')).toEqual({ ok: true, value: null });
  });
});

describe('notifications', () => {
  it('reads own rows, newest 60', async () => {
    const f = fake({ data: [notification] });
    const r = await f.db.notifications('u1');
    expect(f.state).toEqual({ table: 'notifications', op: 'select', arg: NOTIFICATION_COLUMNS });
    expect(f.calls).toEqual([
      ['eq', 'user_id', 'u1'],
      ['order', 'created_at', { ascending: false }],
      ['limit', 60],
    ]);
    expect(r).toEqual({ ok: true, value: [notification] });
  });
  it('markRead updates the ids with .in and returns the rows touched', async () => {
    const f = fake({ data: [{ id: 'n1' }, { id: 'n2' }] });
    const r = await f.db.markRead('u1', ['n1', 'n2']);
    expect(f.state).toEqual({ table: 'notifications', op: 'update', arg: { read: true } });
    expect(f.calls).toEqual([
      ['eq', 'user_id', 'u1'],
      ['in', 'id', ['n1', 'n2']],
      ['select', 'id'],
    ]);
    expect(r).toEqual({ ok: true, value: 2 });
  });
  it('markRead with no ids touches nothing and sends nothing', async () => {
    const f = fake({ data: [] });
    expect(await f.db.markRead('u1', [])).toEqual({ ok: true, value: 0 });
    expect(f.state.table).toBe('');
  });
  it('markAllRead updates only unread rows', async () => {
    const f = fake({ data: [{ id: 'n1' }] });
    const r = await f.db.markAllRead('u1');
    expect(f.state).toEqual({ table: 'notifications', op: 'update', arg: { read: true } });
    expect(f.calls).toEqual([
      ['eq', 'user_id', 'u1'],
      ['eq', 'read', false],
      ['select', 'id'],
    ]);
    expect(r).toEqual({ ok: true, value: 1 });
  });
  it('markUnread (Undo) sets read false on the ids', async () => {
    const f = fake({ data: [{ id: 'n1' }] });
    const r = await f.db.markUnread('u1', ['n1']);
    expect(f.state).toEqual({ table: 'notifications', op: 'update', arg: { read: false } });
    expect(f.calls).toEqual([
      ['eq', 'user_id', 'u1'],
      ['in', 'id', ['n1']],
      ['select', 'id'],
    ]);
    expect(r).toEqual({ ok: true, value: 1 });
  });
  it('remove deletes by id and owner', async () => {
    const f = fake({ data: [{ id: 'n1' }] });
    const r = await f.db.remove('u1', 'n1');
    expect(f.state).toEqual({ table: 'notifications', op: 'delete', arg: undefined });
    expect(f.calls).toEqual([
      ['eq', 'id', 'n1'],
      ['eq', 'user_id', 'u1'],
      ['select', 'id'],
    ]);
    expect(r).toEqual({ ok: true, value: 1 });
  });
  it('zero rows is ok(0) (the hooks decide it is a stale session)', async () => {
    const f = fake({ data: [] });
    expect(await f.db.markAllRead('u1')).toEqual({ ok: true, value: 0 });
  });
  it('a write error maps through the db error', async () => {
    const f = fake({ data: null, error: { code: '42501' }, status: 403 });
    expect(await f.db.remove('u1', 'n1')).toEqual({ ok: false, error: { kind: 'forbidden' } });
  });
  it('an odd write response is a validation error', async () => {
    const f = fake({ data: { id: 'n1' } });
    expect(await f.db.markRead('u1', ['n1'])).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
  });
});

describe('profile', () => {
  it('reads the own users row with explicit columns', async () => {
    const f = fake({ data: profile });
    const r = await f.db.profile('u1');
    expect(f.state).toEqual({ table: 'users', op: 'select', arg: PROFILE_COLUMNS });
    expect(f.calls).toEqual([['eq', 'id', 'u1'], ['maybeSingle']]);
    expect(r).toEqual({ ok: true, value: profile });
  });
  it('saves exactly name, phone, state, address and updated_at', async () => {
    const f = fake({ data: [{ id: 'u1' }] });
    const input = {
      name: 'Ada Obi',
      phone: '+2348031234567',
      state: 'Lagos',
      address: null,
      // Extra keys smuggled in at runtime must never reach the server.
      role: 'admin',
    };
    const r = await f.db.saveProfile('u1', input);
    expect(f.state.table).toBe('users');
    expect(f.state.op).toBe('update');
    const sent = f.state.arg as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['address', 'name', 'phone', 'state', 'updated_at']);
    expect(sent).toEqual(
      expect.objectContaining({
        name: 'Ada Obi',
        phone: '+2348031234567',
        state: 'Lagos',
        address: null,
      }),
    );
    expect(typeof sent.updated_at).toBe('string');
    expect(f.calls).toEqual([
      ['eq', 'id', 'u1'],
      ['select', 'id'],
    ]);
    expect(r).toEqual({ ok: true, value: 1 });
  });
});

describe('withSessionRetry', () => {
  const rows = (n: number) => ok(n);
  function writes(...results: Result<number, ApiError>[]) {
    let i = 0;
    const write = jest.fn(() =>
      Promise.resolve(results[Math.min(i++, results.length - 1)] ?? ok(0)),
    );
    return write;
  }

  it('expected 0: no guard, the write result passes through', async () => {
    const write = writes(rows(0));
    const refresh = jest.fn(() => Promise.resolve(true));
    expect(await withSessionRetry(write, 0, refresh)).toEqual({ ok: true, value: 0 });
    expect(write).toHaveBeenCalledTimes(1);
    expect(refresh).not.toHaveBeenCalled();
  });
  it('rows touched: ok without refreshing', async () => {
    const write = writes(rows(3));
    const refresh = jest.fn(() => Promise.resolve(true));
    expect(await withSessionRetry(write, 3, refresh)).toEqual({ ok: true, value: 3 });
    expect(refresh).not.toHaveBeenCalled();
  });
  it('zero rows: refresh, retry once, then ok', async () => {
    const write = writes(rows(0), rows(2));
    const refresh = jest.fn(() => Promise.resolve(true));
    expect(await withSessionRetry(write, 2, refresh)).toEqual({ ok: true, value: 2 });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('zero rows again after the retry: staleSession', async () => {
    const write = writes(rows(0), rows(0));
    const refresh = jest.fn(() => Promise.resolve(true));
    expect(await withSessionRetry(write, 1, refresh)).toEqual({
      ok: false,
      error: { kind: 'staleSession' },
    });
    expect(write).toHaveBeenCalledTimes(2);
  });
  it('a failed refresh is staleSession without a retry', async () => {
    const write = writes(rows(0));
    const refresh = jest.fn(() => Promise.resolve(false));
    expect(await withSessionRetry(write, 1, refresh)).toEqual({
      ok: false,
      error: { kind: 'staleSession' },
    });
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('a refresh that throws is staleSession, never a rejection', async () => {
    const write = writes(rows(0));
    const refresh = jest.fn(() => Promise.reject(new Error('offline')));
    await expect(withSessionRetry(write, 1, refresh)).resolves.toEqual({
      ok: false,
      error: { kind: 'staleSession' },
    });
    expect(write).toHaveBeenCalledTimes(1);
  });
  it('a write error is returned as is, never retried', async () => {
    const write = writes(err<ApiError>({ kind: 'unavailable', status: 503 }));
    const refresh = jest.fn(() => Promise.resolve(true));
    expect(await withSessionRetry(write, 1, refresh)).toEqual({
      ok: false,
      error: { kind: 'unavailable', status: 503 },
    });
    expect(refresh).not.toHaveBeenCalled();
  });
});
