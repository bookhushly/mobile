import { createVendorHttp } from '@/features/vendor/api/vendorHttp';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

type Call = { path: string; method?: string; body?: unknown; idempotent?: boolean };
type Reply = Result<unknown, ApiError>;

/** A fake API: answers by path (first match), records every call, and runs the real schemas. */
function fake(routes: [RegExp, Reply | ((c: Call) => Reply)][]) {
  const calls: Call[] = [];
  const c = {
    request: <T>(
      path: string,
      opts: {
        method?: string;
        body?: unknown;
        idempotent?: boolean;
        schema: { safeParse: (v: unknown) => { success: boolean; data?: T } };
      },
    ) => {
      const call: Call = {
        path,
        method: opts.method,
        body: opts.body,
        idempotent: opts.idempotent,
      };
      calls.push(call);
      const hit = routes.find(([re]) => re.test(path));
      if (hit === undefined) return Promise.resolve(err<ApiError>({ kind: 'notFound' }));
      const reply = typeof hit[1] === 'function' ? hit[1](call) : hit[1];
      if (!reply.ok) return Promise.resolve(reply);
      const p = opts.schema.safeParse(reply.value);
      return Promise.resolve(p.success ? ok(p.data as T) : err<ApiError>({ kind: 'validation' }));
    },
  };
  return { http: createVendorHttp(c), calls };
}

const offer = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  request_id: 'r1',
  request_type: 'logistics',
  amount: 85_000,
  status: 'pending',
  created_at: '2026-11-28T10:00:00Z',
  expires_at: null,
  ...over,
});
const req = {
  id: 'r1',
  status: 'open',
  service_type: 'moving',
  pickup_state: 'Lagos',
  pickup_date: '2026-12-05',
  expires_at: '2026-11-30T10:00:00Z',
  offer_count: 1,
};

describe('vendorHttp', () => {
  it('me: the profile and where it stands', async () => {
    const { http } = fake([
      [
        /\/api\/vendor\/me$/,
        ok({
          vendor: {
            id: 'v1',
            business_name: ' Swift ',
            business_category: 'logistics',
            approved: true,
            status: 'approved',
            suspended: false,
            rejection_reason: null,
            states: ['Lagos'],
          },
        }),
      ],
    ]);
    expect(await http.me()).toEqual({
      ok: true,
      value: {
        id: 'v1',
        name: 'Swift',
        kind: 'logistics',
        standing: { kind: 'ready' },
        states: ['Lagos'],
      },
    });
  });

  it('requests: the open list plus my offers (Quoted and Won), one row per request', async () => {
    const { http } = fake([
      [
        /\/rfq\/requests\?/,
        ok({ requests: [req], count: 1, page: 1, pageSize: 50, requestType: 'logistics' }),
      ],
      [
        /\/rfq\/offers$/,
        ok({
          offers: [
            {
              ...offer({ id: 'o2', request_id: 'r2', status: 'accepted' }),
              request: {
                type: 'logistics',
                id: 'r2',
                what: 'delivery',
                where: 'Lagos',
                when: '2026-12-01',
                status: 'matched',
              },
            },
            {
              ...offer({ id: 'o3', request_id: 'r2', status: 'withdrawn' }),
              request: {
                type: 'logistics',
                id: 'r2',
                what: 'delivery',
                where: 'Lagos',
                when: '2026-12-01',
                status: 'matched',
              },
            },
          ],
        }),
      ],
    ]);
    const r = await http.requests('logistics');
    expect(r.ok && r.value.map((x) => [x.id, x.myOffer?.status ?? null])).toEqual([
      ['r1', null],
      ['r2', 'accepted'],
    ]);
  });

  it('a hotel can’t use the request routes', async () => {
    const { http, calls } = fake([]);
    expect(await http.requests('hotel')).toEqual({
      ok: false,
      error: { kind: 'forbidden', code: 'wrong_category' },
    });
    expect(calls).toHaveLength(0);
  });

  it('send a quote: the body the route takes, with the key', async () => {
    const { http, calls } = fake([[/\/offers$/, ok({ offer: offer() })]]);
    const r = await http.sendQuote('logistics', 'r1', {
      amount: 85_000,
      message: '',
      vehicleId: null,
      idempotencyKey: 'k-12345678',
    });
    expect(r).toMatchObject({ ok: true, value: { id: 'o1', status: 'pending' } });
    expect(calls[0]).toMatchObject({
      path: '/api/vendor/rfq/requests/logistics/r1/offers',
      method: 'POST',
      body: { amount: 85_000, idempotency_key: 'k-12345678' },
    });
  });

  it('an edited amount on retry is not reported as sent: the earlier quote stands', async () => {
    const { http } = fake([
      [/\/offers$/, err({ kind: 'conflict', code: 'already_offered', body: { offer: offer() } })],
    ]);
    expect(
      (
        await http.sendQuote('logistics', 'r1', {
          amount: 90_000,
          message: '',
          vehicleId: null,
          idempotencyKey: 'k-12345678',
        })
      ).ok,
    ).toBe(false);
  });

  it('a retried quote that already arrived is a success, not "already quoted"', async () => {
    const { http } = fake([
      [/\/offers$/, err({ kind: 'conflict', code: 'already_offered', body: { offer: offer() } })],
    ]);
    expect(
      await http.sendQuote('logistics', 'r1', {
        amount: 85_000,
        message: '',
        vehicleId: null,
        idempotencyKey: 'k-12345678',
      }),
    ).toMatchObject({ ok: true, value: { id: 'o1' } });
  });

  it('withdraw a quote: finds my offer on the request, then withdraws it', async () => {
    const { http, calls } = fake([
      [/\/rfq\/requests\/logistics\/r1$/, ok({ request: req, myOffer: offer() })],
      [/\/offers\/o1\/withdraw$/, ok({ offer: offer({ status: 'withdrawn' }) })],
    ]);
    expect(await http.withdrawQuote('logistics', 'r1')).toMatchObject({
      ok: true,
      value: { status: 'withdrawn' },
    });
    expect(calls.map((c) => c.path)).toEqual([
      '/api/vendor/rfq/requests/logistics/r1',
      '/api/vendor/rfq/offers/o1/withdraw',
    ]);
  });

  it('delivered: uploads the photo to the proof folder first, then sends its address', async () => {
    const job = {
      ...req,
      status: 'in_progress',
      request_type: 'logistics',
      vendor_completed_at: '2026-11-29T09:00:00Z',
      payout_amount: 76_500,
    };
    const { http, calls } = fake([
      [/\/api\/upload$/, ok({ url: 'https://res.cloudinary.com/x/vendors/v1/proof/p.jpg' })],
      [/\/milestone$/, ok({ job })],
    ]);
    const r = await http.milestone('logistics', 'r1', 'delivered', 'file:///p.jpg');
    expect(r.ok).toBe(true);
    expect(calls[0]?.path).toBe('/api/upload');
    expect(calls[0]?.body).toBeInstanceOf(FormData);
    expect(calls[1]).toMatchObject({
      body: {
        milestone: 'delivered',
        photo_url: 'https://res.cloudinary.com/x/vendors/v1/proof/p.jpg',
      },
    });
  });

  it('withdraw money: sends the key and lets the client retry (the server stores the key)', async () => {
    const { http, calls } = fake([
      [/\/wallet\/withdraw$/, ok({ withdrawal: { id: 'w1', status: 'pending', amount: 20_000 } })],
    ]);
    expect(await http.withdraw(20_000, 'key-12345678')).toMatchObject({
      ok: true,
      value: { status: 'pending', amount: 20_000 },
    });
    expect(calls[0]).toMatchObject({
      body: { amount: 20_000, idempotency_key: 'key-12345678' },
      idempotent: true,
    });
  });

  it('an apartment move sends only the new status, then reads the booking back', async () => {
    const row = {
      id: 'a1',
      booking_type: 'apartment',
      status: 'confirmed',
      booking_date: '2026-12-05',
      check_out_date: '2026-12-08',
      guests: 4,
      total_amount: 240_000,
      guest_name: 'Tolu',
      payment_status: 'completed',
      listings: { title: '2-bed suite' },
    };
    const { http, calls } = fake([
      [/\/status$/, ok({ success: true, booking: {} })],
      [/\/api\/vendor\/bookings$/, ok({ bookings: [row] })],
    ]);
    const r = await http.moveBooking('apartment', 'a1', 'confirmed', 'checked_in');
    expect(r.ok).toBe(true);
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({
      path: '/api/vendor/apartment-bookings/a1/status',
      body: { status: 'checked_in' },
    });
  });

  it('a booking that moved since the vendor saw it is refused before anything is sent', async () => {
    const row = {
      id: 'a1',
      booking_type: 'apartment',
      status: 'confirmed',
      booking_date: '2026-12-05',
      check_out_date: '2026-12-08',
      guests: 4,
      total_amount: 240_000,
      guest_name: 'Tolu',
      payment_status: 'completed',
      listings: { title: '2-bed suite' },
    };
    const { http, calls } = fake([[/\/api\/vendor\/bookings$/, ok({ bookings: [row] })]]);
    expect(await http.moveBooking('apartment', 'a1', 'pending', 'cancelled')).toEqual({
      ok: false,
      error: { kind: 'conflict', code: 'stale_status' },
    });
    expect(calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('reads are shared between screens; a write drops them', async () => {
    const { http, calls } = fake([
      [/\/rfq\/jobs$/, ok({ jobs: [] })],
      [/\/start$/, err({ kind: 'conflict', code: 'wrong_status' })],
    ]);
    await http.jobs();
    await http.jobs();
    expect(calls.filter((c) => c.path === '/api/vendor/rfq/jobs')).toHaveLength(1);
    await http.startJob('logistics', 'r1');
    await http.jobs();
    expect(calls.filter((c) => c.path === '/api/vendor/rfq/jobs')).toHaveLength(2);
  });

  it('cancelling a paid stay says whether the guest’s refund went through', async () => {
    const row = (status: string) => ({
      id: 'a1',
      booking_type: 'apartment',
      status,
      booking_date: '2026-12-05',
      check_out_date: '2026-12-08',
      guests: 4,
      total_amount: 240_000,
      guest_name: 'Tolu',
      payment_status: 'completed',
      listings: { title: '2-bed suite' },
    });
    let cancelled = false;
    const { http } = fake([
      [
        /\/status$/,
        () => {
          cancelled = true;
          return ok({ success: true, booking: {}, refunded: false, refund_method: null });
        },
      ],
      [
        /\/api\/vendor\/bookings$/,
        () => ok({ bookings: [row(cancelled ? 'cancelled' : 'confirmed')] }),
      ],
    ]);
    const r = await http.moveBooking('apartment', 'a1', 'confirmed', 'cancelled');
    expect(r).toMatchObject({ ok: true, value: { status: 'cancelled', refund: 'beingFinished' } });
  });
});
