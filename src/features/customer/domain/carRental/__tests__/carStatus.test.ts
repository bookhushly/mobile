import {
  canCancel,
  isPaidStatus,
  isPast,
  needsYou,
  pendingQuotes,
  perDay,
  requestStage,
  stageWords,
  timeline,
} from '@/features/customer/domain/carRental/carStatus';

const NOW = Date.parse('2026-12-02T12:00:00Z');
const LATER = '2026-12-04T13:00:00Z';
const GONE = '2026-12-01T13:00:00Z';

const open = (offerCount: number, expiresAt = LATER) =>
  ({ status: 'open', offerCount, expiresAt }) as const;

describe('requestStage', () => {
  it('waits, then has quotes', () => {
    expect(requestStage(open(0), NOW)).toBe('waiting');
    expect(requestStage(open(2), NOW)).toBe('quotes');
  });

  it('after the deadline: no quotes, unless some came in (they can still be chosen)', () => {
    expect(requestStage(open(0, GONE), NOW)).toBe('noQuotes');
    expect(requestStage(open(1, GONE), NOW)).toBe('quotes');
    expect(requestStage({ status: 'expired', offerCount: 0, expiresAt: GONE }, NOW)).toBe(
      'noQuotes',
    );
  });

  it('follows the paid statuses', () => {
    const at = (status: Parameters<typeof requestStage>[0]['status']) =>
      requestStage({ status, offerCount: 0, expiresAt: LATER }, NOW);
    expect(at('matched')).toBe('chosen');
    expect(at('paid')).toBe('booked');
    expect(at('in_progress')).toBe('onTrip');
    expect(at('completed')).toBe('done');
    expect(at('disputed')).toBe('problem');
    expect(at('refunded')).toBe('refunded');
    expect(at('cancelled')).toBe('cancelled');
  });
});

describe('stageWords', () => {
  it('says the count of quotes, in plain words', () => {
    expect(stageWords('quotes', 1)).toBe('1 quote to compare');
    expect(stageWords('quotes', 3)).toBe('3 quotes to compare');
    expect(stageWords('waiting', 0)).toBe('Waiting for quotes');
    expect(stageWords('chosen', 0)).toBe('Quote chosen · pay to book');
  });
});

describe('needsYou and isPast', () => {
  it('needs you to compare, to pay, and to confirm once the company says it is done', () => {
    expect(needsYou('quotes', null)).toBe(true);
    expect(needsYou('chosen', null)).toBe(true);
    expect(needsYou('onTrip', null)).toBe(false);
    expect(needsYou('onTrip', GONE)).toBe(true);
    expect(needsYou('waiting', null)).toBe(false);
  });

  it('puts finished requests in Past', () => {
    expect(isPast('done')).toBe(true);
    expect(isPast('noQuotes')).toBe(true);
    expect(isPast('cancelled')).toBe(true);
    expect(isPast('booked')).toBe(false);
    expect(isPast('problem')).toBe(false);
  });
});

describe('timeline', () => {
  it('marks steps done, current and later', () => {
    expect(timeline('waiting')).toEqual(['done', 'current', 'later', 'later']);
    expect(timeline('quotes')).toEqual(['done', 'done', 'current', 'later']);
    expect(timeline('chosen')).toEqual(['done', 'done', 'current', 'later']);
    expect(timeline('booked')).toEqual(['done', 'done', 'done', 'current']);
    expect(timeline('done')).toEqual(['done', 'done', 'done', 'done']);
  });
});

describe('quotes', () => {
  it('lists pending quotes, lowest first', () => {
    const offers = [
      { id: 'a', amount: 156000, status: 'pending' },
      { id: 'b', amount: 114000, status: 'pending' },
      { id: 'c', amount: 90000, status: 'rejected' },
    ];
    expect(pendingQuotes(offers).map((o) => o.id)).toEqual(['b', 'a']);
  });

  it('gives a per-day price only for trips longer than a day', () => {
    expect(perDay(114000, 3)).toBe(38000);
    expect(perDay(100000, 3)).toBe(33333);
    expect(perDay(50000, 1)).toBeNull();
  });

  it('allows cancelling until the trip is over', () => {
    expect(canCancel('open')).toBe(true);
    expect(canCancel('in_progress')).toBe(true);
    expect(canCancel('completed')).toBe(false);
    expect(canCancel('cancelled')).toBe(false);
  });
});

describe('isPaidStatus', () => {
  it('is paid from the moment the server records the payment', () => {
    expect(isPaidStatus('matched')).toBe(false);
    expect(isPaidStatus('paid')).toBe(true);
    expect(isPaidStatus('completed')).toBe(true);
    expect(isPaidStatus('cancelled')).toBe(false);
  });
});
