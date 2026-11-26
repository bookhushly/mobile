import { createCalendarHttp } from '@/features/vendor/api/calendarHttp';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

type Call = { path: string; method?: string; body?: unknown };
type Reply = Result<unknown, ApiError>;

/** A fake API: answers by method + path (first match), records calls, runs the real schemas. */
function fake(routes: [string, RegExp, Reply][]) {
  const calls: Call[] = [];
  const c = {
    request: <T>(
      path: string,
      opts: {
        method?: string;
        body?: unknown;
        schema: { safeParse: (v: unknown) => { success: boolean; data?: T } };
      },
    ) => {
      const method = opts.method ?? 'GET';
      calls.push({ path, method, body: opts.body });
      const hit = routes.find(([m, re]) => m === method && re.test(path));
      if (hit === undefined) return Promise.resolve(err<ApiError>({ kind: 'notFound' }));
      const reply = hit[2];
      if (!reply.ok) return Promise.resolve(reply);
      const p = opts.schema.safeParse(reply.value);
      return Promise.resolve(p.success ? ok(p.data as T) : err<ApiError>({ kind: 'validation' }));
    },
  };
  const cleared = { n: 0 };
  const http = createCalendarHttp(c, () => {
    cleared.n += 1;
  });
  return { http, calls, cleared };
}

const month = (blocked: unknown[], booked: unknown[] = []) =>
  ok({ blocked, booked }) satisfies Reply;

describe('calendarHttp', () => {
  it('reads one apartment’s month and draws booked and blocked nights', async () => {
    const { http, calls } = fake([
      [
        'GET',
        /blocked-dates/,
        month(
          [{ id: 'b1', start_date: '2026-12-10', end_date: '2026-12-11', reason: null }],
          [
            {
              check_in_date: '2026-12-05',
              check_out_date: '2026-12-07',
              booking_status: 'confirmed',
            },
          ],
        ),
      ],
    ]);
    const r = await http.calendar('apt 1', '2026-12-01');
    expect(calls[0]?.path).toBe(
      '/api/vendor/apartments/blocked-dates?apartment_id=apt%201&year=2026&month=12',
    );
    expect(r).toEqual({
      ok: true,
      value: { booked: ['2026-12-05', '2026-12-06'], blocked: ['2026-12-10', '2026-12-11'] },
    });
  });

  it('January is asked as February (the route misses January otherwise)', async () => {
    const { http, calls } = fake([['GET', /blocked-dates/, month([])]]);
    await http.calendar('a1', '2027-01-01');
    expect(calls[0]?.path).toMatch(/year=2027&month=2$/);
  });

  it('blocking a free night sends one one-day block, after a fresh read', async () => {
    const { http, calls, cleared } = fake([
      ['GET', /blocked-dates/, month([])],
      ['POST', /blocked-dates$/, ok({ data: { id: 'new' } })],
    ]);
    expect(await http.toggleBlocked('a1', '2026-12-14')).toEqual({ ok: true, value: true });
    expect(cleared.n).toBe(1);
    expect(calls.map((c) => c.method)).toEqual(['GET', 'POST']);
    expect(calls[1]?.body).toEqual({
      apartment_id: 'a1',
      start_date: '2026-12-14',
      end_date: '2026-12-14',
    });
  });

  it('a booked night is refused without sending anything', async () => {
    const { http, calls } = fake([
      [
        'GET',
        /blocked-dates/,
        month([], [{ check_in_date: '2026-12-13', check_out_date: '2026-12-15' }]),
      ],
    ]);
    expect(await http.toggleBlocked('a1', '2026-12-14')).toEqual({
      ok: false,
      error: { kind: 'conflict', code: 'date_booked' },
    });
    expect(calls).toHaveLength(1);
  });

  it('the route’s 409 (a confirmed stay over the night) reads as booked', async () => {
    const { http } = fake([
      ['GET', /blocked-dates/, month([])],
      ['POST', /blocked-dates$/, err<ApiError>({ kind: 'conflict', code: 'conflict' })],
    ]);
    expect(await http.toggleBlocked('a1', '2026-12-14')).toMatchObject({
      ok: false,
      error: { code: 'date_booked' },
    });
  });

  it('opening one night of a longer block recreates the rest first, then removes the old block', async () => {
    const { http, calls } = fake([
      [
        'GET',
        /blocked-dates/,
        month([{ id: 'b1', start_date: '2026-12-10', end_date: '2026-12-15' }]),
      ],
      ['POST', /blocked-dates$/, ok({ data: { id: 'n' } })],
      ['DELETE', /blocked-dates\?id=b1$/, ok({ success: true })],
    ]);
    expect(await http.toggleBlocked('a1', '2026-12-12')).toEqual({ ok: true, value: false });
    expect(calls.map((c) => `${c.method ?? ''} ${JSON.stringify(c.body ?? null)}`)).toEqual([
      'GET null',
      'POST {"apartment_id":"a1","start_date":"2026-12-10","end_date":"2026-12-11"}',
      'POST {"apartment_id":"a1","start_date":"2026-12-13","end_date":"2026-12-15"}',
      'DELETE null',
    ]);
  });

  it('if recreating fails, the old block is left alone (the night stays blocked, never opened)', async () => {
    const { http, calls } = fake([
      [
        'GET',
        /blocked-dates/,
        month([{ id: 'b1', start_date: '2026-12-10', end_date: '2026-12-15' }]),
      ],
      ['POST', /blocked-dates$/, err<ApiError>({ kind: 'network' })],
    ]);
    expect(await http.toggleBlocked('a1', '2026-12-12')).toEqual({
      ok: false,
      error: { kind: 'network' },
    });
    expect(calls.some((c) => c.method === 'DELETE')).toBe(false);
  });

  it('if removing the old block fails after the pieces exist, the night stays blocked and it says so', async () => {
    const { http } = fake([
      [
        'GET',
        /blocked-dates/,
        month([{ id: 'b1', start_date: '2026-12-10', end_date: '2026-12-15' }]),
      ],
      ['POST', /blocked-dates$/, ok({ data: { id: 'n' } })],
      ['DELETE', /blocked-dates/, err<ApiError>({ kind: 'timeout' })],
    ]);
    expect(await http.toggleBlocked('a1', '2026-12-12')).toEqual({
      ok: false,
      error: { kind: 'timeout' },
    });
  });

  it('drops dates it can’t read rather than drawing them on a wrong day', async () => {
    const { http } = fake([
      ['GET', /blocked-dates/, month([{ id: 'x', start_date: 'soon', end_date: '2026-12-02' }])],
    ]);
    expect(await http.calendar('a1', '2026-12-01')).toEqual({
      ok: true,
      value: { booked: [], blocked: [] },
    });
  });
});
