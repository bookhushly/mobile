import type { CheckStatus } from '@/features/customer/schemas/checkout';
import {
  afterPendingVerify,
  flow,
  type FlowState,
  HOLD_MS,
  holdEndsAt,
  nextPollDelay,
  PENDING_REINIT_MS,
  planPay,
  POLL_EVERY_MS,
  POLL_MAX_MS,
  POLL_SCHEDULE_MS,
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

describe('planPay', () => {
  const now = Date.parse('2026-10-21T12:00:00.000Z');
  const payment = { reference: 'ref_1', status: 'pending', created_at: '2026-10-21T11:50:00Z' };
  const paid: CheckStatus = { hasPaid: true, payment: { ...payment, status: 'completed' } };
  const pending: CheckStatus = { hasPaid: false, hasPending: true, payment };
  const none: CheckStatus = { hasPaid: false, hasPending: false };
  const stored = (reference: string, ageMs: number) => ({
    reference,
    paymentUrl: 'https://checkout.paystack.com/abc',
    startedAt: now - ageMs,
  });

  it('hasPaid checks the status poll, never done by itself', () => {
    expect(planPay(paid, stored('ref_1', MIN), now)).toEqual({ do: 'check', reference: 'ref_1' });
    expect(planPay(paid, null, now)).toEqual({ do: 'check', reference: 'ref_1' });
  });

  it('pending with a fresh stored URL for that reference reopens it', () => {
    expect(planPay(pending, stored('ref_1', 23 * HOUR), now)).toEqual({
      do: 'open',
      reference: 'ref_1',
      url: 'https://checkout.paystack.com/abc',
    });
  });

  it('pending with a stored URL 25 h old verifies instead', () => {
    expect(planPay(pending, stored('ref_1', 25 * HOUR), now)).toEqual({
      do: 'verifyPending',
      reference: 'ref_1',
    });
  });

  it('pending with a stored URL for another reference verifies', () => {
    expect(planPay(pending, stored('ref_other', MIN), now)).toEqual({
      do: 'verifyPending',
      reference: 'ref_1',
    });
  });

  it('pending with nothing stored verifies', () => {
    expect(planPay(pending, null, now)).toEqual({ do: 'verifyPending', reference: 'ref_1' });
  });

  it('neither paid nor pending initialises', () => {
    expect(planPay(none, null, now)).toEqual({ do: 'initialize' });
    expect(planPay(none, stored('ref_1', MIN), now)).toEqual({ do: 'initialize' });
  });
});

describe('afterPendingVerify', () => {
  const created = '2026-10-21T11:00:00.000Z';
  const at = (ms: number) => Date.parse(created) + ms;

  it('paid is done', () => {
    expect(afterPendingVerify('paid', created, at(MIN))).toBe('done');
  });

  it('failed initialises anew', () => {
    expect(afterPendingVerify('failed', created, at(MIN))).toBe('initialize');
  });

  it('pending at 14 min waits', () => {
    expect(afterPendingVerify('pending', created, at(14 * MIN))).toBe('wait');
  });

  it('pending at 15 min initialises', () => {
    expect(afterPendingVerify('pending', created, at(15 * MIN))).toBe('initialize');
  });

  it('unknown follows the same age rule', () => {
    expect(afterPendingVerify('unknown', created, at(14 * MIN))).toBe('wait');
    expect(afterPendingVerify('unknown', created, at(16 * MIN))).toBe('initialize');
  });

  it('an unreadable created_at waits, never initialises', () => {
    expect(afterPendingVerify('pending', 'garbage', at(HOUR))).toBe('wait');
  });
});

describe('flow', () => {
  const review: FlowState = { step: 'review' };
  const checking = (startedAt: number, attempt: number, nextDelayMs: number): FlowState => ({
    step: 'checking',
    reference: 'ref_1',
    startedAt,
    attempt,
    nextDelayMs,
  });

  it('pay from review starts', () => {
    expect(flow(review, { type: 'pay' })).toEqual({ step: 'starting' });
  });

  it('pay from startError starts again', () => {
    expect(flow({ step: 'startError', words: 'x' }, { type: 'pay' })).toEqual({ step: 'starting' });
  });

  it('a double pay from starting stays starting', () => {
    const s = flow(review, { type: 'pay' });
    expect(flow(s, { type: 'pay' })).toBe(s);
  });

  it.each<FlowState>([
    { step: 'inBrowser', reference: 'ref_1' },
    checking(0, 0, 2000),
    { step: 'done' },
    { step: 'failed' },
    { step: 'stillChecking', reference: 'ref_1' },
    { step: 'holdEnded' },
    { step: 'pendingElsewhere' },
  ])('pay is ignored in $step', (s) => {
    expect(flow(s, { type: 'pay' })).toBe(s);
  });

  it('opened moves starting to inBrowser', () => {
    expect(flow({ step: 'starting' }, { type: 'opened', reference: 'ref_1' })).toEqual({
      step: 'inBrowser',
      reference: 'ref_1',
    });
  });

  it('returned moves inBrowser to checking from attempt 0', () => {
    expect(flow({ step: 'inBrowser', reference: 'ref_1' }, { type: 'returned', now: 500 })).toEqual(
      checking(500, 0, 2000),
    );
  });

  it('startFailed moves starting to startError', () => {
    expect(flow({ step: 'starting' }, { type: 'startFailed', words: 'Booking not found' })).toEqual(
      {
        step: 'startError',
        words: 'Booking not found',
      },
    );
  });

  it('paid from starting checks the status poll, never done by itself', () => {
    expect(flow({ step: 'starting' }, { type: 'paid', reference: 'ref_1', now: 700 })).toEqual(
      checking(700, 0, 2000),
    );
  });

  it('paid outside starting is ignored', () => {
    const s: FlowState = { step: 'review' };
    expect(flow(s, { type: 'paid', reference: 'ref_1', now: 1 })).toBe(s);
  });

  it('pendingElsewhere ends starting', () => {
    expect(flow({ step: 'starting' }, { type: 'pendingElsewhere' })).toEqual({
      step: 'pendingElsewhere',
    });
  });

  it('verdict paid is done', () => {
    expect(flow(checking(0, 2, 5000), { type: 'verdict', verdict: 'paid', now: 9000 })).toEqual({
      step: 'done',
    });
  });

  it('verdict failed is failed', () => {
    expect(flow(checking(0, 2, 5000), { type: 'verdict', verdict: 'failed', now: 9000 })).toEqual({
      step: 'failed',
    });
  });

  it.each(['pending', 'unknown'] as const)(
    'verdict %s keeps checking with the next attempt',
    (v) => {
      expect(flow(checking(0, 2, 5000), { type: 'verdict', verdict: v, now: 10000 })).toEqual(
        checking(0, 3, 8000),
      );
    },
  );

  it('the first status poll after entering checking counts as attempt 1, 3 s later', () => {
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
    ).toEqual({
      step: 'stillChecking',
      reference: 'ref_1',
    });
  });

  it('verdict outside checking is ignored', () => {
    const s: FlowState = { step: 'inBrowser', reference: 'ref_1' };
    expect(flow(s, { type: 'verdict', verdict: 'paid', now: 1 })).toBe(s);
  });

  it('checkAgain from stillChecking restarts checking', () => {
    expect(
      flow({ step: 'stillChecking', reference: 'ref_1' }, { type: 'checkAgain', now: 200000 }),
    ).toEqual(checking(200000, 0, 2000));
  });

  it('checkAgain from pendingElsewhere runs the pay plan again', () => {
    expect(flow({ step: 'pendingElsewhere' }, { type: 'checkAgain', now: 1 })).toEqual({
      step: 'starting',
    });
  });

  it.each<FlowState>([
    { step: 'failed' },
    { step: 'stillChecking', reference: 'ref_1' },
    { step: 'pendingElsewhere' },
    { step: 'startError', words: 'x' },
  ])('retry from $step goes back to review', (s) => {
    expect(flow(s, { type: 'retry' })).toEqual({ step: 'review' });
  });

  it.each<FlowState>([
    { step: 'starting' },
    { step: 'inBrowser', reference: 'ref_1' },
    checking(0, 1, 3000),
    { step: 'done' },
    { step: 'holdEnded' },
  ])('retry in $step is ignored', (s) => {
    expect(flow(s, { type: 'retry' })).toBe(s);
  });

  it('holdExpired moves review and startError to holdEnded', () => {
    expect(flow(review, { type: 'holdExpired' })).toEqual({ step: 'holdEnded' });
    expect(flow({ step: 'startError', words: 'x' }, { type: 'holdExpired' })).toEqual({
      step: 'holdEnded',
    });
  });

  it('holdExpired during checking is ignored', () => {
    const s = checking(0, 3, 8000);
    expect(flow(s, { type: 'holdExpired' })).toBe(s);
  });

  it.each<FlowState>([
    { step: 'starting' },
    { step: 'inBrowser', reference: 'ref_1' },
    { step: 'stillChecking', reference: 'ref_1' },
    { step: 'done' },
  ])('holdExpired in $step is ignored', (s) => {
    expect(flow(s, { type: 'holdExpired' })).toBe(s);
  });
});
