import { act, fireEvent, render, screen, within } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';

import type { ActionState } from '@/features/customer/hooks/actionState';
import type { CancelDone } from '@/features/customer/hooks/useBookingActions';
import { CancelSheet } from '@/features/customer/ui/CancelSheet';
import { CharCounter } from '@/features/customer/ui/CharCounter';
import { RefundSheet } from '@/features/customer/ui/RefundSheet';
import { ReviewSheet } from '@/features/customer/ui/ReviewSheet';

const noop = () => undefined;

function cancelSheet(state: ActionState<CancelDone>, paid: boolean) {
  return (
    <CancelSheet
      visible
      title="Afrobeats night"
      when="Tue 20 Oct · 7:00 pm"
      money="refundIfReversible"
      paid={paid}
      state={state}
      unsettled={false}
      onCancel={noop}
      onRecheck={noop}
      onClose={noop}
    />
  );
}

describe('CancelSheet', () => {
  it('keeps the refund line when the refetch flips the booking to refunded (final review I1)', async () => {
    await render(cancelSheet({ kind: 'idle' }, true));
    await screen.rerender(cancelSheet({ kind: 'sending' }, true));
    const done: ActionState<CancelDone> = {
      kind: 'done',
      value: { refunded: false, refundMessage: null },
    };
    await screen.rerender(cancelSheet(done, true));
    // The details refetch: payment_status is now 'refunded', so the live prop says unpaid.
    await screen.rerender(cancelSheet(done, false));
    expect(
      screen.getByText(
        'No refund was sent automatically. Contact us on bookhushly.com if you were charged.',
      ),
    ).toBeTruthy();
  });

  it('the money line sits in the summary card, above "This can’t be undone" (U7), one header', async () => {
    await render(cancelSheet({ kind: 'idle' }, true));
    const line = screen.getByText('We’ll refund you if the payment can be reversed.');
    expect(line).toBeTruthy();
    expect(screen.getAllByRole('header')).toHaveLength(1);
  });

  it('a 429 keeps a fixed banner line and ticks the seconds in plain text (ruling b, U1)', async () => {
    jest.useFakeTimers();
    try {
      await render(cancelSheet({ kind: 'rateLimited', retryAfterSec: 3 }, true));
      const banner = within(screen.getByTestId('cancel-notice'));
      expect(banner.getByText('Too many tries. Wait a moment, then try again.')).toBeTruthy();
      expect(screen.getByTestId('rate-limit-wait')).toHaveTextContent('You can try again in 0:03');
      expect(screen.getByTestId('rate-limit-wait').props.accessibilityLiveRegion).toBeUndefined();
      await act(() => {
        jest.advanceTimersByTime(1_000);
      });
      expect(screen.getByTestId('rate-limit-wait')).toHaveTextContent('You can try again in 0:02');
      await act(() => {
        jest.advanceTimersByTime(2_000);
      });
      expect(screen.getByTestId('rate-limit-wait')).toHaveTextContent('You can try again now.');
      expect(banner.getByText('Too many tries. Wait a moment, then try again.')).toBeTruthy();
    } finally {
      jest.useRealTimers();
    }
  });

  it('a lost answer settled as not done reads neutral and allows a new cancel', async () => {
    await render(cancelSheet({ kind: 'notDone' }, true));
    expect(screen.getByText('Couldn’t cancel your booking — try again.')).toBeTruthy();
    expect(
      within(screen.getByTestId('cancel-sheet')).getByRole('button', { name: 'Cancel booking' }),
    ).toBeTruthy();
  });
});

describe('CharCounter (U3)', () => {
  it('is not a live region and is announced once on coming within 20 of the limit', async () => {
    const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
    await render(<CharCounter length={10} max={500} testID="c" />);
    expect(screen.getByTestId('c').props.accessibilityLiveRegion).toBeUndefined();
    await screen.rerender(<CharCounter length={479} max={500} testID="c" />);
    expect(spy).not.toHaveBeenCalled();
    await screen.rerender(<CharCounter length={480} max={500} testID="c" />);
    await screen.rerender(<CharCounter length={490} max={500} testID="c" />);
    expect(spy.mock.calls.map((c) => c[0])).toEqual(['20 characters left']);
    await screen.rerender(<CharCounter length={100} max={500} testID="c" />);
    await screen.rerender(<CharCounter length={495} max={500} testID="c" />);
    expect(spy).toHaveBeenLastCalledWith('5 characters left');
    expect(spy).toHaveBeenCalledTimes(2);
  });
});

describe('Refund and review sheets', () => {
  it('the refund sheet is titled "Ask for a refund" with one header (U6, U9)', async () => {
    await render(
      <RefundSheet
        visible
        title="Afrobeats night"
        when="Tue 20 Oct"
        state={{ kind: 'idle' }}
        onSend={noop}
        onClose={noop}
      />,
    );
    expect(screen.getAllByRole('header')).toHaveLength(1);
    expect(screen.getByRole('header', { name: 'Ask for a refund' })).toBeTruthy();
  });

  it('the review comment states its minimum and checks it on leaving the box (U5)', async () => {
    await render(
      <ReviewSheet
        visible
        title="Harbour Suites"
        when="13 – 15 Oct"
        state={{ kind: 'idle' }}
        onPost={noop}
        onClose={noop}
      />,
    );
    expect(screen.getByText('At least 10 characters. Others see it on the listing.')).toBeTruthy();
    expect(screen.getAllByRole('header')).toHaveLength(1);
    await fireEvent.changeText(screen.getByTestId('review-comment'), 'Too short');
    await fireEvent(screen.getByTestId('review-comment'), 'blur');
    expect(screen.getByText('Write at least 10 characters.')).toBeTruthy();
  });
});
