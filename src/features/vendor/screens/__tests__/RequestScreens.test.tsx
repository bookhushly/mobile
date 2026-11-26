import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  sampleRequest,
  sampleRequests,
  sampleVehicles,
} from '@/features/vendor/api/sampleRequests';
import type { RequestDetail } from '@/features/vendor/domain/requests';
import { QuoteScreen } from '@/features/vendor/screens/QuoteScreen';
import { RequestScreen } from '@/features/vendor/screens/RequestScreen';
import { RequestsScreen } from '@/features/vendor/screens/RequestsScreen';

const NOW = Date.parse('2026-11-29T07:20:00Z');
const noop = () => undefined;

function detail(id: string): RequestDetail {
  const r = sampleRequest('logistics', id, NOW);
  if (!r.ok) throw new Error('sample missing');
  return r.value;
}

const withdraw = { busy: false, problem: null, run: () => Promise.resolve(true) };

describe('RequestsScreen', () => {
  it('New lists open requests to quote, soonest first, with time left', async () => {
    await render(
      <RequestsScreen
        nowMs={NOW}
        tab="new"
        onTab={noop}
        onOpen={noop}
        state={{
          status: 'ready',
          requests: sampleRequests('logistics', NOW),
          refreshing: false,
          refresh: noop,
        }}
      />,
    );
    expect(
      screen.getByRole('button', { name: /Move a 2-bed flat, .*5 h left · 2 quotes/ }),
    ).toBeTruthy();
    expect(screen.queryByText('Fridge to Ikorodu')).toBeNull();
  });

  it('Quoted shows your quote, Won shows the chosen one; each tab has its own empty state', async () => {
    const requests = sampleRequests('logistics', NOW);
    const r = await render(
      <RequestsScreen
        nowMs={NOW}
        tab="quoted"
        onTab={noop}
        onOpen={noop}
        state={{ status: 'ready', requests, refreshing: false, refresh: noop }}
      />,
    );
    expect(screen.getByText('Your quote ₦28,000 · waiting for the customer')).toBeTruthy();
    await r.rerender(
      <RequestsScreen
        nowMs={NOW}
        tab="won"
        onTab={noop}
        onOpen={noop}
        state={{ status: 'ready', requests, refreshing: false, refresh: noop }}
      />,
    );
    expect(screen.getByText('Chosen · ₦85,000')).toBeTruthy();
    await r.rerender(
      <RequestsScreen
        nowMs={NOW}
        tab="won"
        onTab={noop}
        onOpen={noop}
        state={{ status: 'ready', requests: [], refreshing: false, refresh: noop }}
      />,
    );
    expect(screen.getByText('Nothing won yet')).toBeTruthy();
  });
});

describe('RequestScreen', () => {
  it('an open request: what was asked, no contact details, and Send a quote', async () => {
    const onQuote = jest.fn();
    await render(
      <RequestScreen
        nowMs={NOW}
        onBack={noop}
        onQuote={onQuote}
        onOpenJobs={noop}
        withdraw={withdraw}
        state={{ status: 'ready', request: detail('sample-req-1') }}
      />,
    );
    expect(screen.getByRole('header', { name: 'Move a 2-bed flat' })).toBeTruthy();
    expect(
      screen.getByLabelText('From Admiralty Way, Lekki Phase 1 to Herbert Macaulay Way, Yaba'),
    ).toBeTruthy();
    expect(screen.getByText('5 h to quote')).toBeTruthy();
    expect(screen.getByText('Third floor, no lift at the old place.')).toBeTruthy();
    expect(screen.getByText('Their name and phone show once they pay')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-send-quote'));
    expect(onQuote).toHaveBeenCalled();
  });

  it('a quote waiting for the customer can be withdrawn after a confirm', async () => {
    const run = jest.fn(() => Promise.resolve(true));
    await render(
      <RequestScreen
        nowMs={NOW}
        onBack={noop}
        onQuote={noop}
        onOpenJobs={noop}
        withdraw={{ ...withdraw, run }}
        state={{ status: 'ready', request: detail('sample-req-4') }}
      />,
    );
    expect(screen.queryByTestId('vendor-send-quote')).toBeNull();
    await fireEvent.press(screen.getByTestId('vendor-withdraw'));
    await fireEvent.press(screen.getByTestId('vendor-withdraw-confirm'));
    expect(run).toHaveBeenCalled();
  });

  it('a won request points to Jobs; a missing one says so', async () => {
    const r = await render(
      <RequestScreen
        nowMs={NOW}
        onBack={noop}
        onQuote={noop}
        onOpenJobs={noop}
        withdraw={withdraw}
        state={{ status: 'ready', request: detail('sample-req-5') }}
      />,
    );
    expect(screen.getByText('Open Jobs')).toBeTruthy();
    await r.rerender(
      <RequestScreen
        nowMs={NOW}
        onBack={noop}
        onQuote={noop}
        onOpenJobs={noop}
        withdraw={withdraw}
        state={{ status: 'error', notFound: true, retry: noop }}
      />,
    );
    expect(screen.getByText('This request isn’t available')).toBeTruthy();
  });

  it('a failed withdraw on a bad connection is neutral, never a refusal', async () => {
    await render(
      <RequestScreen
        nowMs={NOW}
        onBack={noop}
        onQuote={noop}
        onOpenJobs={noop}
        withdraw={{
          ...withdraw,
          problem: { title: 'We couldn’t reach Bookhushly', message: 'm', transient: true },
        }}
        state={{ status: 'ready', request: detail('sample-req-4') }}
      />,
    );
    // Shown in the confirm sheet, where the vendor is looking, not behind it.
    await fireEvent.press(screen.getByTestId('vendor-withdraw'));
    expect(screen.getByText('We couldn’t reach Bookhushly')).toBeTruthy();
  });
});

describe('QuoteScreen', () => {
  const base = {
    request: detail('sample-req-1'),
    vehicles: sampleVehicles('logistics'),
    feeRate: 0.1,
    sending: false,
    problem: null,
    onBack: noop,
  };

  it('shows the fee and what you keep as you type', async () => {
    await render(<QuoteScreen {...base} onSend={noop} />);
    await fireEvent.changeText(screen.getByTestId('vendor-quote-amount'), '85,000');
    expect(screen.getByTestId('vendor-quote-receive')).toHaveTextContent('₦76,500');
    expect(screen.getByText('You’ll receive ₦76,500')).toBeTruthy();
  });

  it('will not send without a valid price and a vehicle, and says why', async () => {
    const onSend = jest.fn();
    await render(<QuoteScreen {...base} onSend={onSend} />);
    await fireEvent.press(screen.getByTestId('vendor-quote-send'));
    expect(onSend).not.toHaveBeenCalled();
    expect(screen.getByText('Enter your price')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('vendor-quote-amount'), '500');
    expect(screen.getByText('The lowest quote is ₦1,000')).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('vendor-quote-amount'), '85000');
    await fireEvent.press(screen.getByTestId('vendor-quote-send'));
    expect(screen.getByText('Choose the vehicle you’ll send')).toBeTruthy();
    expect(onSend).not.toHaveBeenCalled();
  });

  it('sends the amount, the trimmed message and the vehicle', async () => {
    const onSend = jest.fn();
    await render(<QuoteScreen {...base} onSend={onSend} />);
    await fireEvent.changeText(screen.getByTestId('vendor-quote-amount'), '85000');
    await fireEvent.press(screen.getByTestId('vendor-vehicle-v-1'));
    await fireEvent.changeText(
      screen.getByTestId('vendor-quote-message'),
      '  Two loaders included.  ',
    );
    await fireEvent.press(screen.getByTestId('vendor-quote-send'));
    expect(onSend).toHaveBeenCalledWith({
      amount: 85_000,
      message: 'Two loaders included.',
      vehicleId: 'v-1',
    });
  });

  it('with no past job to read the fee from, it says the fee comes off, without guessing it', async () => {
    await render(<QuoteScreen {...base} feeRate={null} onSend={noop} />);
    await fireEvent.changeText(screen.getByTestId('vendor-quote-amount'), '85000');
    expect(screen.getByText(/Bookhushly’s fee comes off this price/)).toBeTruthy();
    expect(screen.queryByText(/You’ll receive ₦/)).toBeNull();
  });

  it('security companies have no vehicle to pick', async () => {
    const onSend = jest.fn();
    await render(<QuoteScreen {...base} vehicles={[]} onSend={onSend} />);
    expect(screen.queryByText('Which vehicle?')).toBeNull();
    await fireEvent.changeText(screen.getByTestId('vendor-quote-amount'), '150000');
    await fireEvent.press(screen.getByTestId('vendor-quote-send'));
    expect(onSend).toHaveBeenCalledWith({ amount: 150_000, message: '', vehicleId: null });
  });
});
