import {
  activityLine,
  bankLabel,
  withdrawProblem,
  type Activity,
} from '@/features/vendor/domain/earnings';

describe('withdrawProblem', () => {
  it('a whole amount from ₦500 up to what you have', () => {
    expect(withdrawProblem('', 326_500)).toBe('Enter an amount');
    expect(withdrawProblem('12.5', 326_500)).toBe('Enter a whole amount in naira');
    expect(withdrawProblem('400', 326_500)).toBe('The smallest withdrawal is ₦500');
    expect(withdrawProblem('400000', 326_500)).toBe('You have ₦326,500 to withdraw');
    expect(withdrawProblem('326,500', 326_500)).toBeNull();
  });
  it('nothing to withdraw says so', () => {
    expect(withdrawProblem('500', 0)).toBe('You have nothing to withdraw yet');
  });
});

describe('bankLabel', () => {
  it('the bank and the last two digits only', () => {
    expect(bankLabel({ name: 'GTBank', last2: '42' })).toBe('GTBank ••42');
  });
});

describe('activityLine', () => {
  const a = (over: Partial<Activity>): Activity => ({
    id: 'a',
    kind: 'payout',
    title: 'Parcel to V.I.',
    at: '2026-11-24T10:00:00Z',
    amount: 22_500,
    status: 'completed',
    ...over,
  });
  it('payouts and withdrawals, in words with their state', () => {
    expect(activityLine(a({}))).toBe('Tue 24 Nov · customer confirmed');
    expect(activityLine(a({ kind: 'withdrawal', status: 'pending' }))).toBe(
      'Tue 24 Nov · being checked by Bookhushly',
    );
    expect(activityLine(a({ kind: 'withdrawal', status: 'processing' }))).toBe(
      'Tue 24 Nov · on its way',
    );
    expect(activityLine(a({ kind: 'withdrawal', status: 'completed' }))).toBe('Tue 24 Nov · sent');
    expect(activityLine(a({ kind: 'withdrawal', status: 'failed' }))).toBe(
      'Tue 24 Nov · didn’t go through, money returned',
    );
    expect(activityLine(a({ kind: 'bankPayout' }))).toBe('Tue 24 Nov · paid to your bank');
  });
});
