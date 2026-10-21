import type { PaymentState, Verified } from '@/features/customer/schemas/checkout';
import type { ApiError } from '@/shared/lib/errors';
import { fromPaymentState, fromVerified, startErrorWords } from '../paymentStatus';

const state = (status: string, fulfilled: boolean): PaymentState => ({
  payment: { reference: 'ref_1', status, fulfilled, request_type: 'event' },
  request: null,
});

describe('fromPaymentState', () => {
  it('completed and fulfilled is paid', () => {
    expect(fromPaymentState(state('completed', true))).toBe('paid');
  });

  it('completed but not yet fulfilled is still pending', () => {
    expect(fromPaymentState(state('completed', false))).toBe('pending');
  });

  it.each(['failed', 'expired', 'abandoned'])('%s is failed', (status) => {
    expect(fromPaymentState(state(status, false))).toBe('failed');
  });

  it.each(['pending', 'waiting', 'processing', ''])('%s is pending', (status) => {
    expect(fromPaymentState(state(status, false))).toBe('pending');
  });

  it('legacy success counts as completed', () => {
    expect(fromPaymentState(state('success', true))).toBe('paid');
    expect(fromPaymentState(state('success', false))).toBe('pending');
  });

  it('fulfilled alone is not paid', () => {
    expect(fromPaymentState(state('pending', true))).toBe('pending');
  });
});

describe('fromVerified', () => {
  const v = (verified: boolean, status: string): Verified => ({ verified, status });

  it('verified completed is paid', () => {
    expect(fromVerified(v(true, 'completed'))).toBe('paid');
  });

  it('unverified failed is failed', () => {
    expect(fromVerified(v(false, 'failed'))).toBe('failed');
  });

  it('unverified completed is pending', () => {
    expect(fromVerified(v(false, 'completed'))).toBe('pending');
  });

  it('unverified pending is pending', () => {
    expect(fromVerified(v(false, 'pending'))).toBe('pending');
  });

  it('verified with any other status is pending', () => {
    expect(fromVerified(v(true, 'failed'))).toBe('pending');
  });
});

describe('startErrorWords', () => {
  const TRY_AGAIN = "Couldn't start payment. Try again";

  it('maps 409 booking_total_invalid', () => {
    const e: ApiError = { kind: 'conflict', code: 'booking_total_invalid' };
    expect(startErrorWords(e)).toBe("This booking's price couldn't be confirmed. Start again");
  });

  it('maps 403', () => {
    expect(startErrorWords({ kind: 'forbidden' })).toBe("This booking isn't on your account");
  });

  it('maps 404', () => {
    expect(startErrorWords({ kind: 'notFound' })).toBe('Booking not found');
  });

  it('503 gives the try-again text, never a refusal', () => {
    expect(startErrorWords({ kind: 'unavailable', status: 503 })).toBe(TRY_AGAIN);
  });

  it.each<ApiError>([
    { kind: 'unavailable', status: 500 },
    { kind: 'rateLimited' },
    { kind: 'network' },
    { kind: 'timeout' },
    { kind: 'validation' },
    { kind: 'unknown', status: 400 },
    { kind: 'conflict', code: 'something_else' },
  ])('$kind gives the try-again text', (e) => {
    expect(startErrorWords(e)).toBe(TRY_AGAIN);
  });
});
