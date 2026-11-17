import type { CheckStatus, Initialized } from '@/features/customer/schemas/checkout';
import {
  acceptReuse,
  afterPendingVerify,
  flow,
  type FlowState,
  HOLD_MS,
  holdEndsAt,
  isPaymentUrl,
  nextPollDelay,
  PENDING_REINIT_MS,
  planPay,
  POLL_EVERY_MS,
  POLL_MAX_MS,
  POLL_SCHEDULE_MS,
  REUSE_WINDOW_MS,
  rowPayState,
  URL_MAX_AGE_MS,
} from '../paymentFlow';

const MIN = 60_000;
const HOUR = 3600_000;

describe('constants', () => {
  it('match P6, P8 and P26', () => {
    expect(POLL_SCHEDULE_MS).toEqual([2000, 3000, 5000, 8000, 13000]);
    expect(POLL_EVERY_MS).toBe(15000);
    expect(POLL_MAX_MS).toBe(180000);
    expect(HOLD_MS).toBe(25 * MIN);
    expect(URL_MAX_AGE_MS).toBe(24 * HOUR);
    expect(PENDING_REINIT_MS).toBe(15 * MIN);
    expect(REUSE_WINDOW_MS).toBe(30 * MIN);
  });
});

describe('nextPollDelay', () => {
  it('follows the schedule, then every 15 s', () => {
    expect(nextPollDelay(0, 0)).toBe(2000);
    expect(nextPollDelay(2000, 1)).toBe(3000);
    expect(nextPollDelay(5000, 2)).toBe(5000);
    expect(nextPollDelay(10000, 3)).toBe(8000);
    expect(nextPollDelay(18000, 4)).toBe(13000);
    expect(nextPollDelay(31000, 5)).toBe(15000);
    expect(nextPollDelay(46000, 9)).toBe(15000);
  });

  it('allows a poll that lands exactly at 180 s', () => {
    expect(nextPollDelay(165000, 12)).toBe(15000);
  });

  it('returns null once the next poll would pass 180 s', () => {
    expect(nextPollDelay(170000, 12)).toBeNull();
    expect(nextPollDelay(180000, 13)).toBeNull();
    expect(nextPollDelay(180000, 0)).toBeNull();
  });
});

describe('holdEndsAt', () => {
  const iso = '2026-10-21T10:00:00.000Z';
  const created = Date.parse(iso);

  it('hold window closes at 25 minutes', () => {
    expect(holdEndsAt('hotel', iso)).toBe(created + 1_500_000);
    expect(holdEndsAt('apartment', iso)).toBe(created + 1_500_000);
  });

  it('events have no hold', () => {
    expect(holdEndsAt('event', iso)).toBeNull();
  });

  it('an unreadable created_at counts as already ended', () => {
    expect(holdEndsAt('hotel', 'not a date')).toBe(0);
  });
});

describe('rowPayState', () => {
  it('is null while the row is loading or missing', () => {
    expect(rowPayState('event', undefined)).toBeNull();
    expect(rowPayState('hotel', null)).toBeNull();
  });

  it('reads events from status and payment_status', () => {
    expect(rowPayState('event', { status: 'pending', payment_status: 'pending' })).toBe('unpaid');
    expect(rowPayState('event', { status: 'confirmed', payment_status: 'completed' })).toBe('paid');
    expect(rowPayState('event', { status: 'cancelled', payment_status: 'completed' })).toBe(
      'cancelled',
    );
    expect(rowPayState('event', { status: 'confirmed', payment_status: 'pending' })).toBe('other');
  });

  it('reads hotels from payment_status, apartments paid as paid', () => {
    expect(rowPayState('hotel', { booking_status: 'confirmed', payment_status: 'pending' })).toBe(
      'unpaid',
    );
    expect(rowPayState('hotel', { booking_status: 'confirmed', payment_status: 'completed' })).toBe(
      'paid',
    );
    expect(rowPayState('hotel', { booking_status: 'cancelled', payment_status: 'pending' })).toBe(
      'cancelled',
    );
    expect(rowPayState('apartment', { booking_status: 'pending', payment_status: 'paid' })).toBe(
      'paid',
    );
    expect(rowPayState('apartment', { booking_status: 'pending', payment_status: 'pending' })).toBe(
      'unpaid',
    );
    expect(
      rowPayState('apartment', { booking_status: 'confirmed', payment_status: 'completed' }),
    ).toBe('other');
    expect(rowPayState('hotel', { booking_status: 'confirmed', payment_status: 'failed' })).toBe(
      'other',
    );
  });
});

describe('isPaymentUrl', () => {
  it.each([
    'https://checkout.paystack.com/abc',
    'https://paystack.com/pay/x',
    'https://standard.paystack.co/charge?x=1',
    'https://CHECKOUT.PAYSTACK.COM/abc',
  ])('accepts %s', (u) => {
    expect(isPaymentUrl(u)).toBe(true);
  });

  it.each([
    'http://checkout.paystack.com/abc',
    'https://checkout.paystack.com.evil.test/abc',
    'https://evilpaystack.com/abc',
    'https://checkout.paystack.com@evil.test/abc',
    'https://paystack.co/abc',
    'https://nowpayments.io/x',
    'javascript:alert(1)',
    '',
  ])('rejects %s', (u) => {
    expect(isPaymentUrl(u)).toBe(false);
  });
});

describe('planPay', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');
  // Started 20 min ago: old enough to verify (A1).
  const payment = { reference: 'ref_1', status: 'pending', created_at: '2026-10-21T11:40:00Z' };
  const paid: CheckStatus = { hasPaid: true, payment: { ...payment, status: 'completed' } };
  const pending: CheckStatus = { hasPaid: false, hasPending: true, payment };
  const none: CheckStatus = { hasPaid: false, hasPending: false };
  const stored = (
    reference: string,
    ageMs: number,
    paymentUrl = 'https://checkout.paystack.com/abc',
  ) => ({
    reference,
    paymentUrl,
    startedAt: now - ageMs,
  });
  const created = Date.parse(payment.created_at);

  it('hasPaid checks the status poll, never done by itself', () => {
    expect(planPay(paid, stored('ref_1', MIN), now)).toEqual({
      do: 'check',
      reference: 'ref_1',
      paymentStartedAt: created,
    });
    expect(planPay(paid, null, now)).toEqual({
      do: 'check',
      reference: 'ref_1',
      paymentStartedAt: created,
    });
  });

  it('pending with a fresh stored URL for that reference reopens it', () => {
    expect(planPay(pending, stored('ref_1', 23 * HOUR), now)).toEqual({
      do: 'open',
      reference: 'ref_1',
      url: 'https://checkout.paystack.com/abc',
      paymentStartedAt: now - 23 * HOUR,
    });
  });

  // An unusable stored URL counts as none (P26): under 30 min the pending checkout is asked for.
  const reuse = { do: 'reuse', reference: 'ref_1', paymentStartedAt: created };

  it('a stored URL off the Paystack allowlist is never reopened', () => {
    expect(planPay(pending, stored('ref_1', MIN, 'https://evil.test/pay'), now)).toEqual(reuse);
  });

  it('pending with a stored URL 25 h old is treated as having no URL', () => {
    expect(planPay(pending, stored('ref_1', 25 * HOUR), now)).toEqual(reuse);
  });

  it('pending with a stored URL for another reference is treated as having no URL', () => {
    expect(planPay(pending, stored('ref_other', MIN), now)).toEqual(reuse);
  });

  it('pending 30 min old or more with nothing stored verifies', () => {
    const old: CheckStatus = {
      hasPaid: false,
      hasPending: true,
      payment: { ...payment, created_at: '2026-10-21T11:30:00Z' },
    };
    expect(planPay(old, null, now)).toEqual({ do: 'verifyPending', reference: 'ref_1' });
  });

  it('pending under 30 min old with no URL asks initialise for the same checkout (V3)', () => {
    expect(planPay(pending, null, now)).toEqual({
      do: 'reuse',
      reference: 'ref_1',
      paymentStartedAt: created,
    });
    const fresh: CheckStatus = {
      hasPaid: false,
      hasPending: true,
      payment: { ...payment, created_at: '2026-10-21T11:30:00.001Z' },
    };
    expect(planPay(fresh, stored('ref_other', MIN), now)).toMatchObject({ do: 'reuse' });
  });

  it('pending with an unreadable created_at verifies, never reuses', () => {
    const unreadable: CheckStatus = {
      hasPaid: false,
      hasPending: true,
      payment: { ...payment, created_at: 'garbage' },
    };
    expect(planPay(unreadable, null, now)).toEqual({ do: 'verifyPending', reference: 'ref_1' });
  });

  it('neither paid nor pending initialises', () => {
    expect(planPay(none, null, now)).toEqual({ do: 'initialize' });
    expect(planPay(none, stored('ref_1', MIN), now)).toEqual({ do: 'initialize' });
  });
});

describe('acceptReuse', () => {
  const init = (reference: string, reused?: boolean): Initialized => ({
    success: true,
    ...(reused !== undefined ? { reused } : {}),
    payment: {
      id: 'p1',
      reference,
      amount: 1,
      base_amount: 1,
      service_charge_amount: 0,
      service_charge_label: null,
      currency: 'NGN',
      payment_url: 'https://checkout.paystack.com/abc',
    },
  });

  it('accepts only reused:true for the same reference (V3)', () => {
    expect(acceptReuse(init('ref_1', true), 'ref_1')).toBe(true);
    expect(acceptReuse(init('ref_2', true), 'ref_1')).toBe(false);
    expect(acceptReuse(init('ref_1', false), 'ref_1')).toBe(false);
    expect(acceptReuse(init('ref_1'), 'ref_1')).toBe(false);
  });
});

describe('afterPendingVerify', () => {
  const created = '2026-10-21T11:00:00.000Z';
  const at = (ms: number) => Date.parse(created) + ms;

  it('paid is done', () => {
    expect(afterPendingVerify('paid', null, created, at(MIN))).toBe('done');
  });

  it('failed initialises anew', () => {
    expect(afterPendingVerify('failed', 'failed', created, at(MIN))).toBe('initialize');
  });

  it('pending at 14 min waits', () => {
    expect(afterPendingVerify('pending', null, created, at(14 * MIN))).toBe('wait');
  });

  it('pending at 15 min initialises', () => {
    expect(afterPendingVerify('pending', null, created, at(15 * MIN))).toBe('initialize');
  });

  it('unknown follows the same age rule', () => {
    expect(afterPendingVerify('unknown', null, created, at(14 * MIN))).toBe('wait');
    expect(afterPendingVerify('unknown', undefined, created, at(16 * MIN))).toBe('initialize');
  });

  it.each(['ongoing', 'pending', 'processing', 'queued'])(
    'Paystack %s waits at any age: a transfer or USSD may still land (V2)',
    (ps) => {
      expect(afterPendingVerify('pending', ps, created, at(5 * HOUR))).toBe('wait');
      expect(afterPendingVerify('unknown', ps, created, at(HOUR))).toBe('wait');
    },
  );

  it('an unreadable created_at waits, never initialises', () => {
    expect(afterPendingVerify('pending', null, 'garbage', at(HOUR))).toBe('wait');
  });
});

describe('flow', () => {
  const review: FlowState = { step: 'review' };
  // The payment itself started at 0 unless a test says otherwise.
  const checking = (
    startedAt: number,
    attempt: number,
    nextDelayMs: number,
    verify = false,
  ): FlowState => ({
    step: 'checking',
    reference: 'ref_1',
    paymentStartedAt: 0,
    startedAt,
    attempt,
    nextDelayMs,
    verify,
  });
  const inBrowser: FlowState = { step: 'inBrowser', reference: 'ref_1', paymentStartedAt: 0 };
  const still: FlowState = { step: 'stillChecking', reference: 'ref_1', paymentStartedAt: 0 };
  const unconfirmed: FlowState = { step: 'unconfirmed', reference: 'ref_1', paymentStartedAt: 0 };

  it('pay from review starts', () => {
    expect(flow(review, { type: 'pay' })).toEqual({ step: 'starting' });
  });

  it('pay from startError starts again', () => {
    expect(flow({ step: 'startError', words: 'x', action: 'tryAgain' }, { type: 'pay' })).toEqual({
      step: 'starting',
    });
  });

  it('a double pay from starting stays starting', () => {
    const s = flow(review, { type: 'pay' });
    expect(flow(s, { type: 'pay' })).toBe(s);
  });

  it.each<FlowState>([
    inBrowser,
    checking(0, 0, 2000),
    { step: 'done', reference: 'ref_1' },
    { step: 'failed', reference: 'ref_1' },
    unconfirmed,
    still,
    { step: 'holdEnded' },
    { step: 'pendingElsewhere' },
  ])('pay is ignored in $step (Try again goes back to Review first)', (s) => {
    expect(flow(s, { type: 'pay' })).toBe(s);
  });

  it('opened moves starting to inBrowser', () => {
    expect(
      flow({ step: 'starting' }, { type: 'opened', reference: 'ref_1', paymentStartedAt: 0 }),
    ).toEqual(inBrowser);
  });

  it('returned moves inBrowser to checking, verify first (V1); the first status poll is 2 s later', () => {
    expect(flow(inBrowser, { type: 'returned', now: 500 })).toEqual(checking(500, 0, 2000, true));
  });

  it('startFailed moves starting to startError', () => {
    expect(
      flow({ step: 'starting' }, { type: 'startFailed', words: 'Booking not found', action: null }),
    ).toEqual({
      step: 'startError',
      words: 'Booking not found',
      action: null,
    });
  });

  it('paid from starting checks the status poll, never done by itself', () => {
    expect(
      flow(
        { step: 'starting' },
        { type: 'paid', reference: 'ref_1', paymentStartedAt: 0, now: 700 },
      ),
    ).toEqual(checking(700, 0, 2000));
  });

  it('paid outside starting is ignored', () => {
    const s: FlowState = { step: 'review' };
    expect(flow(s, { type: 'paid', reference: 'ref_1', paymentStartedAt: 0, now: 1 })).toBe(s);
  });

  it('pendingElsewhere ends starting', () => {
    expect(flow({ step: 'starting' }, { type: 'pendingElsewhere' })).toEqual({
      step: 'pendingElsewhere',
    });
  });

  it('verdict paid is done', () => {
    expect(flow(checking(0, 2, 5000), { type: 'verdict', verdict: 'paid', now: 9000 })).toEqual({
      step: 'done',
      reference: 'ref_1',
    });
  });

  it('a status poll failed is unconfirmed without a definitive verify, at any age (V1)', () => {
    expect(
      flow(checking(0, 2, 5000), { type: 'verdict', verdict: 'failed', now: 15 * MIN }),
    ).toEqual(unconfirmed);
    expect(flow(checking(0, 2, 5000), { type: 'verdict', verdict: 'failed', now: 1 })).toEqual(
      unconfirmed,
    );
  });

  it('a definitive verify failure is failed at once (V1)', () => {
    expect(
      flow(checking(0, 0, 2000, true), {
        type: 'verified',
        verdict: 'failed',
        definitive: true,
        now: 100,
      }),
    ).toEqual({ step: 'failed', reference: 'ref_1' });
  });

  it.each(['paid', 'pending', 'unknown', 'failed'] as const)(
    'any other verify answer (%s) goes on to the status polls',
    (verdict) => {
      expect(
        flow(checking(0, 0, 2000, true), { type: 'verified', verdict, definitive: false, now: 9 }),
      ).toEqual(checking(0, 0, 2000));
    },
  );

  it('verified outside a verifying check is ignored', () => {
    const s = checking(0, 1, 3000);
    expect(flow(s, { type: 'verified', verdict: 'failed', definitive: true, now: 1 })).toBe(s);
    expect(flow(review, { type: 'verified', verdict: 'failed', definitive: true, now: 1 })).toBe(
      review,
    );
  });

  it.each(['pending', 'unknown'] as const)(
    'verdict %s keeps checking with the next attempt',
    (v) => {
      expect(flow(checking(0, 2, 5000), { type: 'verdict', verdict: v, now: 10000 })).toEqual(
        checking(0, 3, 8000),
      );
    },
  );

  it('a 503 Retry-After pushes the next poll out, and is never failed (W4)', () => {
    expect(
      flow(checking(0, 0, 2000), {
        type: 'verdict',
        verdict: 'unknown',
        now: 2000,
        retryAfterMs: 5000,
      }),
    ).toEqual(checking(0, 1, 5000));
    // A shorter Retry-After never shortens the schedule.
    expect(
      flow(checking(0, 2, 5000), {
        type: 'verdict',
        verdict: 'unknown',
        now: 10000,
        retryAfterMs: 1000,
      }),
    ).toEqual(checking(0, 3, 8000));
  });

  it('the second status poll comes 3 s after the first', () => {
    expect(flow(checking(0, 0, 2000), { type: 'verdict', verdict: 'pending', now: 2000 })).toEqual(
      checking(0, 1, 3000),
    );
  });

  it('a poll that would land exactly at 180 s is still scheduled', () => {
    expect(
      flow(checking(0, 12, 15000), { type: 'verdict', verdict: 'unknown', now: 165000 }),
    ).toEqual(checking(0, 13, 15000));
  });

  it('exhausting polls becomes stillChecking', () => {
    expect(
      flow(checking(0, 12, 15000), { type: 'verdict', verdict: 'pending', now: 170000 }),
    ).toEqual(still);
  });

  it('verdict outside checking is ignored', () => {
    expect(flow(inBrowser, { type: 'verdict', verdict: 'paid', now: 1 })).toBe(inBrowser);
  });

  it('checkAgain from stillChecking restarts checking, verifying once', () => {
    expect(flow(still, { type: 'checkAgain', now: 200000 })).toEqual(
      checking(200000, 0, 2000, true),
    );
  });

  it('checkAgain from unconfirmed verifies and polls the same reference again', () => {
    expect(flow(unconfirmed, { type: 'checkAgain', now: 9000 })).toEqual(
      checking(9000, 0, 2000, true),
    );
  });

  it('checkAgain from pendingElsewhere runs the pay plan again', () => {
    expect(flow({ step: 'pendingElsewhere' }, { type: 'checkAgain', now: 1 })).toEqual({
      step: 'starting',
    });
  });

  it.each<FlowState>([
    { step: 'failed', reference: 'ref_1' },
    still,
    { step: 'pendingElsewhere' },
    { step: 'startError', words: 'x', action: 'tryAgain' },
  ])('retry from $step goes back to review', (s) => {
    expect(flow(s, { type: 'retry' })).toEqual({ step: 'review' });
  });

  it.each<FlowState>([
    { step: 'starting' },
    inBrowser,
    checking(0, 1, 3000),
    { step: 'done', reference: 'ref_1' },
    unconfirmed,
    { step: 'holdEnded' },
  ])('retry in $step is ignored', (s) => {
    expect(flow(s, { type: 'retry' })).toBe(s);
  });

  it('holdExpired moves review and startError to holdEnded', () => {
    expect(flow(review, { type: 'holdExpired' })).toEqual({ step: 'holdEnded' });
    expect(
      flow({ step: 'startError', words: 'x', action: 'tryAgain' }, { type: 'holdExpired' }),
    ).toEqual({
      step: 'holdEnded',
    });
  });

  it('holdExpired during checking is ignored', () => {
    const s = checking(0, 3, 8000);
    expect(flow(s, { type: 'holdExpired' })).toBe(s);
  });

  it.each<FlowState>([
    { step: 'starting' },
    inBrowser,
    still,
    unconfirmed,
    { step: 'done', reference: 'ref_1' },
  ])('holdExpired in $step is ignored', (s) => {
    expect(flow(s, { type: 'holdExpired' })).toBe(s);
  });
});
