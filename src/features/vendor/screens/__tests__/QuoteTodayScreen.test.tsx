import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { sampleToday } from '@/features/vendor/api/sampleToday';
import type { VendorToday } from '@/features/vendor/domain/today';
import { QuoteTodayScreen, type QuoteTodayProps } from '@/features/vendor/screens/QuoteTodayScreen';

// 2026-11-29 08:20 in Lagos.
const NOW = Date.parse('2026-11-29T07:20:00Z');
const noop = () => undefined;

function props(data: VendorToday, over: Partial<QuoteTodayProps> = {}): QuoteTodayProps {
  return {
    businessName: 'Swift Haulage',
    kindWord: 'Logistics',
    today: '2026-11-29',
    nowMs: NOW,
    state: { status: 'ready', data, refreshing: false, refresh: noop },
    onOpenRequests: noop,
    onOpenRequest: noop,
    onOpenJobs: noop,
    onOpenJob: noop,
    onOpenEarnings: noop,
    ...over,
  };
}

describe('QuoteTodayScreen', () => {
  it('opens with the business, the date and the day in a line', async () => {
    await render(<QuoteTodayScreen {...props(sampleToday('logistics', NOW))} />);
    expect(screen.getByText('Swift Haulage')).toBeTruthy();
    expect(screen.getByRole('header', { name: '2 jobs today,\n3 requests to quote' })).toBeTruthy();
    expect(screen.getByText('Sunday 29 November')).toBeTruthy();
    expect(screen.getByTestId('vendor-headline')).toHaveTextContent(
      '2 jobs today,\n3 requests to quote',
    );
  });

  it('summary rows say what needs you, and each one opens its tab', async () => {
    const onOpenRequests = jest.fn();
    const onOpenEarnings = jest.fn();
    await render(
      <QuoteTodayScreen
        {...props(sampleToday('logistics', NOW), { onOpenRequests, onOpenEarnings })}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'New requests, 3. First one closes in 5 h' }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'To withdraw, ₦326,500. ₦86,000 on hold' }),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-row-requests'));
    await fireEvent.press(screen.getByTestId('vendor-row-withdraw'));
    expect(onOpenRequests).toHaveBeenCalled();
    expect(onOpenEarnings).toHaveBeenCalled();
  });

  it('a job already running leads, with its start time and one action', async () => {
    const onOpenJob = jest.fn();
    await render(<QuoteTodayScreen {...props(sampleToday('logistics', NOW), { onOpenJob })} />);
    expect(screen.getByText('7:50 · now')).toBeTruthy();
    expect(
      within(screen.getByTestId('vendor-next-job')).getByText('Parcel to Victoria Island'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-next-job-open'));
    expect(onOpenJob).toHaveBeenCalledWith(expect.objectContaining({ id: 'sample-job-2' }));
  });

  it('a quiet day: no job card, no request strip, and the headline says so', async () => {
    const quiet = { ...sampleToday('logistics', NOW), jobs: [], requests: [] };
    await render(<QuoteTodayScreen {...props(quiet)} />);
    expect(screen.getByTestId('vendor-headline')).toHaveTextContent('No jobs today');
    expect(screen.queryByTestId('vendor-next-job')).toBeNull();
    expect(screen.queryByText('See all 0')).toBeNull();
  });

  it('this month against the same days last month', async () => {
    await render(<QuoteTodayScreen {...props(sampleToday('logistics', NOW))} />);
    expect(screen.getByText('1–29 Nov')).toBeTruthy();
    expect(screen.getByText('1–29 Oct')).toBeTruthy();
    expect(screen.getByLabelText('Up 18 percent on last month')).toBeTruthy();
  });

  it('a failed load offers try again, never an empty Today', async () => {
    const retry = jest.fn();
    await render(
      <QuoteTodayScreen
        {...props(sampleToday('logistics', NOW), { state: { status: 'error', retry } })}
      />,
    );
    expect(screen.getByText('We couldn’t load today')).toBeTruthy();
  });
});
