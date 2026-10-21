import {
  checkPayment,
  createEvent,
  createStay,
  initializePayment,
  paymentState,
  roomAvailability,
  serviceCharge,
  validatePromo,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';

import { fakeRequester } from './fakeRequester';

describe('checkoutApi', () => {
  it('initialize body has no amount or metadata', async () => {
    const { client, calls } = fakeRequester({ error: { kind: 'network' } });
    await initializePayment(client, 'hotel', 'b1', 'a@b.co');
    expect(calls[0]?.path).toBe('/api/payment/initialize');
    const body = calls[0]?.opts.body as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(
      ['currency', 'email', 'provider', 'requestId', 'requestType'].sort(),
    );
    expect(body).toEqual({
      requestId: 'b1',
      requestType: 'hotel',
      provider: 'paystack',
      currency: 'NGN',
      email: 'a@b.co',
    });
  });

  it('createStay sends Idempotency-Key and is never auto-retried (A5)', async () => {
    const { client, calls } = fakeRequester({ error: { kind: 'network' } });
    await createStay(client, 'apartment', { a: 1 }, 'key-1');
    expect(calls[0]?.path).toBe('/api/bookings/apartment');
    expect(calls[0]?.opts.method).toBe('POST');
    expect(calls[0]?.opts.idempotent).toBe(false);
    expect(calls[0]?.opts.headers).toEqual({ 'Idempotency-Key': 'key-1' });
    expect(calls[0]?.opts.body).toEqual({ a: 1 });
  });

  it('createEvent is not idempotent and picks the free or paid route', async () => {
    const { client, calls } = fakeRequester({ error: { kind: 'network' } });
    await createEvent(client, {}, true);
    await createEvent(client, {}, false);
    expect(calls.map((c) => c.path)).toEqual([
      '/api/bookings/event/free',
      '/api/bookings/event/create',
    ]);
    for (const c of calls) {
      expect('idempotent' in c.opts).toBe(false);
      expect('headers' in c.opts).toBe(false);
    }
  });

  it('paymentState encodes the reference', async () => {
    const { client, calls } = fakeRequester({ error: { kind: 'network' } });
    await paymentState(client, 'ref/1 x');
    expect(calls[0]?.path).toBe('/api/payment/status/ref%2F1%20x');
  });

  it('the pre-create reads are public (auth: false)', async () => {
    const { client, calls } = fakeRequester({ error: { kind: 'network' } });
    await roomAvailability(client, 'r1', '2026-11-01', '2026-11-03');
    await validatePromo(client, { code: 'X', service_type: 'hotel', service_id: 'h', amount: 5 });
    await serviceCharge(client, 'hotel');
    expect(calls.map((c) => c.path)).toEqual([
      '/api/hotels/room-types/r1/availability?checkIn=2026-11-01&checkOut=2026-11-03',
      '/api/promo/validate',
      '/api/service-charges?type=hotel',
    ]);
    for (const c of calls) expect(c.opts.auth).toBe(false);
  });

  it('check and verify post the documented bodies', async () => {
    const { client, calls } = fakeRequester({ error: { kind: 'network' } });
    await checkPayment(client, 'event', 'b1');
    await verifyPayment(client, 'ref1');
    expect(calls[0]?.opts.body).toEqual({ requestId: 'b1', requestType: 'event' });
    expect(calls[1]?.opts.body).toEqual({ reference: 'ref1', provider: 'paystack' });
  });

  it('parses a response through its schema', async () => {
    const { client } = fakeRequester({ body: { charge: null } });
    expect(await serviceCharge(client, 'hotel')).toEqual({ ok: true, value: { charge: null } });
  });
});
