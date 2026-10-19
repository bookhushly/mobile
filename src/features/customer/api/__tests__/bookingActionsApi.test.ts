import {
  cancelBooking,
  requestRefund,
  transferTickets,
} from '@/features/customer/api/bookingActionsApi';
import { cancelBody } from '@/features/customer/schemas/actions';

import { fakeRequester } from './fakeRequester';

describe('cancelBooking', () => {
  it.each(['event', 'hotel', 'apartment'] as const)(
    'POSTs /api/bookings/%s/{id}/cancel with no body, never idempotent',
    async (kind) => {
      const { client, calls } = fakeRequester({ body: { success: true, refunded: false } });
      await cancelBooking(client, kind, 'b/1');
      expect(calls[0]?.path).toBe(`/api/bookings/${kind}/b%2F1/cancel`);
      expect(calls[0]?.opts.method).toBe('POST');
      expect(calls[0]?.opts.schema).toBe(cancelBody);
      expect('body' in (calls[0]?.opts ?? {})).toBe(false);
      expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
    },
  );

  it('reads the event/apartment and hotel refund answers alike', async () => {
    const ev = fakeRequester({
      body: { success: true, refunded: true, refund_method: 'paystack' },
    });
    expect(await cancelBooking(ev.client, 'event', 'b1')).toEqual({
      ok: true,
      value: { refunded: true, refundMessage: null },
    });
    const ho = fakeRequester({
      body: { success: true, refund_initiated: true, refund_message: 'Refund has been queued' },
    });
    expect(await cancelBooking(ho.client, 'hotel', 'b1')).toEqual({
      ok: true,
      value: { refunded: true, refundMessage: 'Refund has been queued' },
    });
    const none = fakeRequester({ body: { success: true, refund_initiated: false } });
    expect(await cancelBooking(none.client, 'hotel', 'b1')).toEqual({
      ok: true,
      value: { refunded: false, refundMessage: null },
    });
  });
});

describe('requestRefund', () => {
  it('POSTs exactly {booking_id, reason} (trimmed)', async () => {
    const { client, calls } = fakeRequester({ body: { refund_request: { id: 'rr1', x: 1 } } });
    expect(await requestRefund(client, 'b1', '  Can’t make it  ')).toEqual({
      ok: true,
      value: { id: 'rr1' },
    });
    expect(calls[0]?.path).toBe('/api/refunds/request');
    expect(calls[0]?.opts.method).toBe('POST');
    expect(calls[0]?.opts.body).toEqual({ booking_id: 'b1', reason: 'Can’t make it' });
    expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
  });

  it.each(['', '   ', 'x'.repeat(501)])('an empty or long reason is never sent', async (reason) => {
    const { client, calls } = fakeRequester({ body: {} });
    expect(await requestRefund(client, 'b1', reason)).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
    expect(calls).toHaveLength(0);
  });

  it('500 characters is allowed', async () => {
    const { client, calls } = fakeRequester({ body: { refund_request: { id: 'rr1' } } });
    await requestRefund(client, 'b1', 'x'.repeat(500));
    expect(calls).toHaveLength(1);
  });
});

describe('transferTickets', () => {
  it('POSTs exactly {new_email}, trimmed and lowercased', async () => {
    const { client, calls } = fakeRequester({ body: { transferred_to: 'bola@example.com' } });
    expect(await transferTickets(client, 'b/1', ' Bola@Example.com ')).toEqual({
      ok: true,
      value: { transferredTo: 'bola@example.com' },
    });
    expect(calls[0]?.path).toBe('/api/bookings/event/b%2F1/transfer');
    expect(calls[0]?.opts.method).toBe('POST');
    expect(calls[0]?.opts.body).toEqual({ new_email: 'bola@example.com' });
    expect('idempotent' in (calls[0]?.opts ?? {})).toBe(false);
  });

  it.each(['', 'bola', 'bola@'])('an invalid email %p is never sent', async (email) => {
    const { client, calls } = fakeRequester({ body: {} });
    expect(await transferTickets(client, 'b1', email)).toEqual({
      ok: false,
      error: { kind: 'validation' },
    });
    expect(calls).toHaveLength(0);
  });
});
