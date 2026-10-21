import type { PaymentState, Verified } from '@/features/customer/schemas/checkout';
import type { ApiError } from '@/shared/lib/errors';
import {
  fromPaymentState,
  fromVerified,
  isDefinitiveFailure,
  providerStillProcessing,
  settleVerdict,
  startErrorAction,
  startErrorWords,
} from '../paymentStatus';

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
  const TRY_AGAIN = 'Couldn’t start payment. Try again';

  it('maps 409 booking_total_invalid', () => {
    const e: ApiError = { kind: 'conflict', code: 'booking_total_invalid' };
    expect(startErrorWords(e)).toBe('This booking’s price couldn’t be confirmed. Start again');
  });

  it('maps 403', () => {
    expect(startErrorWords({ kind: 'forbidden' })).toBe('This booking isn’t on your account');
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

describe('startErrorAction', () => {
  it('a price that could not be confirmed starts again', () => {
    expect(startErrorAction({ kind: 'conflict', code: 'booking_total_invalid' })).toBe(
      'startAgain',
    );
  });
  it('a refusal has no button', () => {
    expect(startErrorAction({ kind: 'forbidden' })).toBeNull();
    expect(startErrorAction({ kind: 'notFound' })).toBeNull();
  });
  it('anything transient tries again', () => {
    expect(startErrorAction({ kind: 'unavailable', status: 503 })).toBe('tryAgain');
    expect(startErrorAction({ kind: 'network' })).toBe('tryAgain');
  });
});

// W1: web #223 codes on POST /api/payment/initialize.
describe('initialise codes (web #223)', () => {
  const alreadyPaid: ApiError = { kind: 'conflict', code: 'already_paid' };
  const cancelled: ApiError = { kind: 'conflict', code: 'booking_cancelled' };
  const emailRequired: ApiError = { kind: 'unknown', status: 400, code: 'email_required' };
  const recordFailed: ApiError = { kind: 'unavailable', status: 500, code: 'record_failed' };
  const initFailed: ApiError = { kind: 'unavailable', status: 500, code: 'init_failed' };

  it('already_paid says so and never retries: it goes to Checking (or Done)', () => {
    expect(startErrorWords(alreadyPaid)).toBe('This booking is already paid.');
    expect(startErrorAction(alreadyPaid)).toBe('paid');
  });

  it('booking_cancelled starts again', () => {
    expect(startErrorWords(cancelled)).toBe('This booking has ended. Start again to book.');
    expect(startErrorAction(cancelled)).toBe('startAgain');
  });

  it('email_required is a refusal, not transient', () => {
    expect(startErrorWords(emailRequired)).toBe('Add an email to your profile to pay.');
    expect(startErrorAction(emailRequired)).toBeNull();
  });

  it('record_failed checks again (check-status runs before any new Pay)', () => {
    expect(startErrorWords(recordFailed)).toBe('Couldn’t start payment. Check again.');
    expect(startErrorAction(recordFailed)).toBe('checkAgain');
  });

  it('init_failed and other 5xx keep the try-again words', () => {
    expect(startErrorWords(initFailed)).toBe('Couldn’t start payment. Try again');
    expect(startErrorAction(initFailed)).toBe('tryAgain');
    expect(startErrorWords({ kind: 'unavailable', status: 502 })).toBe(
      'Couldn’t start payment. Try again',
    );
  });
});

// V1/V2: web #222 reports Paystack's own status on an unverified verify.
describe('providerStillProcessing', () => {
  it.each(['ongoing', 'pending', 'processing', 'queued'])('%s is still processing', (ps) => {
    expect(providerStillProcessing(ps)).toBe(true);
  });
  it.each(['failed', 'reversed', 'abandoned', 'success', '', null, undefined])(
    '%s is not',
    (ps) => {
      expect(providerStillProcessing(ps)).toBe(false);
    },
  );
});

describe('isDefinitiveFailure', () => {
  const v = (verified: boolean, status: string, ps?: string | null): Verified => ({
    verified,
    status,
    ...(ps !== undefined ? { provider_status: ps } : {}),
  });

  it.each(['failed', 'reversed'])('verify failed with Paystack %s is definitive', (ps) => {
    expect(isDefinitiveFailure(v(false, 'failed', ps))).toBe(true);
  });

  it.each(['abandoned', 'ongoing', 'pending', null])(
    'verify failed with Paystack %s is not definitive',
    (ps) => {
      expect(isDefinitiveFailure(v(false, 'failed', ps))).toBe(false);
    },
  );

  it('no provider_status is never definitive', () => {
    expect(isDefinitiveFailure(v(false, 'failed'))).toBe(false);
  });

  it('a row not written failed is never definitive', () => {
    expect(isDefinitiveFailure(v(false, 'pending', 'failed'))).toBe(false);
    expect(isDefinitiveFailure(v(true, 'failed', 'failed'))).toBe(false);
  });
});

// Resume (P5, V1): one verify and one status read per entry per pass.
describe('settleVerdict', () => {
  const definitive: Verified = { verified: false, status: 'failed', provider_status: 'failed' };
  const soft: Verified = { verified: false, status: 'failed', provider_status: 'abandoned' };
  const ongoing: Verified = { verified: false, status: 'pending', provider_status: 'ongoing' };

  it('a fulfilled status is paid, whatever verify said', () => {
    expect(settleVerdict(null, state('completed', true))).toBe('paid');
    expect(settleVerdict(ongoing, state('completed', true))).toBe('paid');
  });

  it('a definitive verify failure is failed, with or without a status answer', () => {
    expect(settleVerdict(definitive, state('failed', false))).toBe('failed');
    expect(settleVerdict(definitive, null)).toBe('failed');
  });

  it('a failed status without a definitive verify is left for later', () => {
    expect(settleVerdict(null, state('failed', false))).toBe('unknown');
    expect(settleVerdict(soft, state('failed', false))).toBe('unknown');
  });

  it('pending, in progress or no answers settle nothing', () => {
    expect(settleVerdict(ongoing, state('pending', false))).toBe('unknown');
    expect(settleVerdict(null, null)).toBe('unknown');
    expect(settleVerdict(null, state('completed', false))).toBe('unknown');
  });
});
