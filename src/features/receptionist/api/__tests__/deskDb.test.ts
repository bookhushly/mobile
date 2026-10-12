import {
  createDeskDb,
  type DeskQuery,
  type SupabaseLike,
} from '@/features/receptionist/api/deskDb';
import { parseCheckInCode } from '@/features/receptionist/domain/checkInCode';
import { BOOKING_COLUMNS, ROOM_COLUMNS, STAFF_COLUMNS } from '@/features/receptionist/schemas/desk';

// The default instance binds the native client; these tests only use createDeskDb with a fake.
jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));

type Call = [string, ...unknown[]];
type Res = { data: unknown; error?: { code?: string } | null; status?: number };

function fake(res: Res) {
  const calls: Call[] = [];
  const state = { table: '', select: '' };
  const row = { data: res.data, error: res.error ?? null, status: res.status ?? 200 };
  const q: DeskQuery = Object.assign(Promise.resolve(row), {
    eq: (c: string, v: string) => {
      calls.push(['eq', c, v]);
      return q;
    },
    or: (f: string) => {
      calls.push(['or', f]);
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
  const client: SupabaseLike = {
    from: (table) => {
      state.table = table;
      return {
        select: (columns) => {
          state.select = columns;
          return q;
        },
      };
    },
  };
  return { db: createDeskDb(client), calls, state };
}

const code = () => {
  const p = parseCheckInCode('ABCD1234');
  if (!p.ok) throw new Error('fixture');
  return p.code;
};

const room = {
  id: 'r1',
  room_number: 101,
  floor: 1,
  status: 'available',
  room_type_id: 't1',
  last_cleaned_at: null,
  hotel_room_types: { name: 'Standard' },
};
const booking = {
  id: 'b1',
  guest_name: 'Ada',
  guest_phone: null,
  check_in_date: '2026-10-11',
  check_out_date: '2026-10-12',
  adults: 1,
  children: 0,
  booking_status: 'confirmed',
  payment_status: 'completed',
  checked_in: false,
  checked_in_at: null,
  checked_out_at: null,
  check_in_code: 'ABCD1234',
  special_requests: null,
  hotel_rooms: null,
};

describe('select strings', () => {
  it.each([BOOKING_COLUMNS, ROOM_COLUMNS, STAFF_COLUMNS])('never read PII or money: %s', (s) => {
    for (const banned of ['guest_email', 'total', 'amount', 'customer_id']) {
      expect(s).not.toContain(banned);
    }
  });
});

describe('staffHotels', () => {
  it('reads hotel_staff by user_id with the exported columns', async () => {
    const f = fake({ data: [{ hotel_id: 'h1', hotels: null }] });
    const r = await f.db.staffHotels('u1');
    expect(f.state).toEqual({ table: 'hotel_staff', select: STAFF_COLUMNS });
    expect(f.calls).toEqual([['eq', 'user_id', 'u1']]);
    expect(r).toEqual({ ok: true, value: [{ hotel_id: 'h1', hotels: null }] });
  });
});

describe('guests', () => {
  it('filters by hotel and today, newest check-in first, capped at 500', async () => {
    const f = fake({ data: [booking] });
    const r = await f.db.guests('h1', '2026-10-11');
    expect(f.state).toEqual({ table: 'hotel_bookings', select: BOOKING_COLUMNS });
    expect(f.calls).toEqual([
      ['eq', 'hotel_id', 'h1'],
      [
        'or',
        // Legacy in-house rows (no booking_status, checked_in) load too.
        'booking_status.eq.checked_in,and(booking_status.is.null,checked_in.is.true),and(booking_status.eq.confirmed,payment_status.eq.completed,check_in_date.lte.2026-10-11,check_out_date.gte.2026-10-11)',
      ],
      // Descending, so the 500 cap drops the oldest rows.
      ['order', 'check_in_date', { ascending: false }],
      ['limit', 500],
    ]);
    expect(r.ok).toBe(true);
  });
  it('a row failing the schema is a validation error', async () => {
    const f = fake({ data: [{ ...booking, check_in_date: 'tomorrow' }] });
    expect(await f.db.guests('h1', '2026-10-11')).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
  });
  it('a 503 is unavailable, never a business answer', async () => {
    const f = fake({ data: null, error: { code: 'PGRST000' }, status: 503 });
    expect(await f.db.guests('h1', '2026-10-11')).toEqual({
      ok: false,
      error: { kind: 'unavailable', status: 503 },
    });
  });
});

describe('bookingByCode / bookingById', () => {
  it('looks up by hotel and code with maybeSingle', async () => {
    const f = fake({ data: booking });
    const r = await f.db.bookingByCode('h1', code());
    expect(f.state).toEqual({ table: 'hotel_bookings', select: BOOKING_COLUMNS });
    expect(f.calls).toEqual([
      ['eq', 'hotel_id', 'h1'],
      ['eq', 'check_in_code', 'ABCD1234'],
      ['maybeSingle'],
    ]);
    expect(r).toEqual({ ok: true, value: booking });
  });
  it('no match is ok(null)', async () => {
    const f = fake({ data: null });
    expect(await f.db.bookingByCode('h1', code())).toEqual({ ok: true, value: null });
  });
  it('looks up by hotel and id', async () => {
    const f = fake({ data: booking });
    const r = await f.db.bookingById('h1', 'b1');
    expect(f.calls).toEqual([['eq', 'hotel_id', 'h1'], ['eq', 'id', 'b1'], ['maybeSingle']]);
    expect(r).toEqual({ ok: true, value: booking });
  });
  it('several rows (PGRST116) maps through the db error', async () => {
    const f = fake({ data: null, error: { code: 'PGRST116' }, status: 406 });
    expect(await f.db.bookingById('h1', 'b1')).toEqual({
      ok: false,
      error: { kind: 'unknown', status: 406 },
    });
  });
});

describe('rooms', () => {
  it('reads the hotel rooms by floor then number, capped at 1000', async () => {
    const f = fake({ data: [room] });
    const r = await f.db.rooms('h1');
    expect(f.state).toEqual({ table: 'hotel_rooms', select: ROOM_COLUMNS });
    expect(f.calls).toEqual([
      ['eq', 'hotel_id', 'h1'],
      ['order', 'floor'],
      ['order', 'room_number'],
      ['limit', 1000],
    ]);
    expect(r).toEqual({ ok: true, value: [room] });
  });
  it('a 403 is forbidden', async () => {
    const f = fake({ data: null, error: { code: '42501' }, status: 403 });
    expect(await f.db.rooms('h1')).toEqual({ ok: false, error: { kind: 'forbidden' } });
  });
});
