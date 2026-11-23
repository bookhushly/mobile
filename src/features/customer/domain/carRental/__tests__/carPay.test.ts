import { planCarPay } from '@/features/customer/domain/carRental/carPay';

const NOW = Date.parse('2026-12-01T10:00:00Z');
const URL = 'https://checkout.paystack.com/abc';
const pending = (createdAt: string) =>
  ({
    hasPaid: false,
    hasPending: true,
    payment: { reference: 'ref1', status: 'pending', created_at: createdAt },
  }) as const;

describe('planCarPay', () => {
  it('never starts a charge without an answer from check-status', () => {
    expect(planCarPay(null, null, NOW)).toEqual({ kind: 'cantCheck' });
  });

  it('a completed payment waits for the request to read paid', () => {
    const paid = {
      hasPaid: true,
      payment: { reference: 'ref0', status: 'completed', created_at: '2026-12-01T09:00:00Z' },
    } as const;
    expect(planCarPay(paid, null, NOW)).toEqual({ kind: 'paid', reference: 'ref0' });
  });

  it('starts only when nothing is open', () => {
    expect(planCarPay({ hasPaid: false, hasPending: false }, null, NOW)).toEqual({ kind: 'start' });
  });

  it('reopens the same checkout this device opened recently', () => {
    const stored = { reference: 'ref1', url: URL, startedAt: NOW - 5 * 60_000 };
    expect(planCarPay(pending('2026-12-01T09:55:00Z'), stored, NOW)).toEqual({
      kind: 'reopen',
      reference: 'ref1',
      url: URL,
    });
  });

  it('waits on a recent open payment started elsewhere (or with no saved link)', () => {
    expect(planCarPay(pending('2026-12-01T09:55:00Z'), null, NOW)).toEqual({
      kind: 'wait',
      reference: 'ref1',
    });
    const other = { reference: 'ref9', url: URL, startedAt: NOW - 60_000 };
    expect(planCarPay(pending('2026-12-01T09:55:00Z'), other, NOW).kind).toBe('wait');
    expect(planCarPay(pending('not a date'), null, NOW).kind).toBe('wait');
  });

  it('an old open payment is verified before any new charge', () => {
    expect(planCarPay(pending('2026-12-01T09:00:00Z'), null, NOW)).toEqual({
      kind: 'verifyThenStart',
      reference: 'ref1',
    });
  });

  it('never reopens a link that is not a Paystack checkout', () => {
    const stored = { reference: 'ref1', url: 'https://evil.example/pay', startedAt: NOW - 60_000 };
    expect(planCarPay(pending('2026-12-01T09:59:00Z'), stored, NOW).kind).toBe('wait');
  });
});
