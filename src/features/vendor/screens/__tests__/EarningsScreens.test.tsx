import { fireEvent, render, screen } from '@testing-library/react-native';

import { sampleEarnings, sampleWithdraw } from '@/features/vendor/api/sampleEarnings';
import type { Earnings } from '@/features/vendor/domain/earnings';
import { EarningsScreen } from '@/features/vendor/screens/EarningsScreen';
import { WithdrawSheet } from '@/features/vendor/ui/WithdrawSheet';

const NOW = Date.parse('2026-11-29T07:20:00Z');
const noop = () => undefined;
const labels = { thisMonth: '1–29 Nov', lastMonth: '1–29 Oct' };
const ready = (earnings: Earnings) => ({
  status: 'ready' as const,
  earnings,
  refreshing: false,
  refresh: noop,
});

describe('EarningsScreen', () => {
  it('quote vendors: the month, what you can take out, what’s held, and every payment', async () => {
    const onWithdraw = jest.fn();
    await render(
      <EarningsScreen
        labels={labels}
        onOpenWeb={noop}
        onWithdraw={onWithdraw}
        state={ready(sampleEarnings('logistics', NOW))}
      />,
    );
    expect(screen.getByLabelText('To withdraw, ₦326,500. Yours now')).toBeTruthy();
    expect(screen.getByLabelText('On hold, ₦86,000. Until 2 customers confirm')).toBeTruthy();
    expect(screen.getByText('To GTBank ••42')).toBeTruthy();
    expect(screen.getByText('−₦150,000')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-withdraw'));
    expect(onWithdraw).toHaveBeenCalled();
  });

  it('hotels, apartments and events are paid to their bank: no withdraw', async () => {
    await render(
      <EarningsScreen
        labels={labels}
        onOpenWeb={noop}
        onWithdraw={noop}
        state={ready(sampleEarnings('hotel', NOW))}
      />,
    );
    expect(
      screen.getByText('Paystack pays your share to Access Bank ••17 after each booking.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('vendor-withdraw')).toBeNull();
  });

  it('without a bank account, withdraw is off and says why', async () => {
    await render(
      <EarningsScreen
        labels={labels}
        onOpenWeb={noop}
        onWithdraw={noop}
        state={ready({ ...sampleEarnings('logistics', NOW), bank: null })}
      />,
    );
    expect(screen.getByText('Add a bank account on bookhushly.com to withdraw.')).toBeTruthy();
  });

  it('a failed load says the money is safe', async () => {
    await render(
      <EarningsScreen
        labels={labels}
        onOpenWeb={noop}
        onWithdraw={noop}
        state={{ status: 'error', retry: noop }}
      />,
    );
    expect(
      screen.getByText('Your money is safe. Check your connection and try again.'),
    ).toBeTruthy();
  });
});

describe('WithdrawSheet', () => {
  const bank = { name: 'GTBank', last2: '42' };
  const base = {
    visible: true,
    available: 326_500,
    bank,
    busy: false,
    problem: null,
    done: null,
    onClose: noop,
  };

  it('starts with everything you have, and checks the amount', async () => {
    const onWithdraw = jest.fn();
    await render(<WithdrawSheet {...base} onWithdraw={onWithdraw} />);
    expect(screen.getByDisplayValue('326500')).toBeTruthy();
    expect(screen.getByText('GTBank ••42')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('vendor-withdraw-amount'), '400000');
    await fireEvent.press(screen.getByTestId('vendor-withdraw-send'));
    expect(onWithdraw).not.toHaveBeenCalled();
    expect(screen.getByText('You have ₦326,500 to withdraw')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('vendor-withdraw-amount'), '100,000');
    await fireEvent.press(screen.getByTestId('vendor-withdraw-send'));
    expect(onWithdraw).toHaveBeenCalledWith(100_000);
  });

  it('after asking, says Bookhushly checks it before sending', async () => {
    await render(<WithdrawSheet {...base} done={100_000} onWithdraw={noop} />);
    expect(
      screen.getByText(/₦100,000 to GTBank ••42\. Bookhushly checks each withdrawal/),
    ).toBeTruthy();
  });
});

describe('sample withdraw', () => {
  it('moves money out of "to withdraw" and shows as being checked; never more than you have', () => {
    expect(sampleWithdraw('security', 2_000_000, NOW)).toMatchObject({
      ok: false,
      error: { code: 'insufficient_balance' },
    });
    expect(sampleWithdraw('security', 40_000, NOW)).toMatchObject({
      ok: true,
      value: { status: 'pending' },
    });
    expect(sampleEarnings('security', NOW).wallet?.available).toBe(500_000);
  });
});
