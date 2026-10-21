import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { BackHandler } from 'react-native';

import type { FlowState } from '@/features/customer/domain/checkout/paymentFlow';
import { useBooking } from '@/features/customer/hooks/useBooking';
import { useServiceCharge } from '@/features/customer/hooks/useCheckoutData';
import { usePayment } from '@/features/customer/hooks/usePayment';
import type { CheckoutEntry } from '@/features/customer/offline/checkoutStore';
import { eventBookingRow, hotelBookingRow } from '@/features/customer/schemas/bookings';
import { PayScreen } from '@/features/customer/screens/PayScreen';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/customer/hooks/usePayment', () => ({ usePayment: jest.fn() }));
jest.mock('@/features/customer/hooks/useBooking', () => ({ useBooking: jest.fn() }));
jest.mock('@/features/customer/hooks/useCheckoutData', () => ({ useServiceCharge: jest.fn() }));
const mockDrop = jest.fn((_u: string, _k: string, _id: string) => Promise.resolve());
jest.mock('@/features/customer/offline/checkoutStore', () => ({
  checkoutStore: { drop: (u: string, k: string, id: string) => mockDrop(u, k, id) },
}));
const mockCue = jest.fn();
jest.mock('@/shared/platform/feedback', () => ({
  createFeedback: () => ({ cue: mockCue }),
}));
const mockFlags = { payments: true };
jest.mock('@/shared/config/features', () => ({
  get CHECKOUT_PAYMENTS_ENABLED() {
    return mockFlags.payments;
  },
}));
const mockOpenWeb = jest.fn();
jest.mock('@/features/customer/ui/links', () => ({
  WEB_DASHBOARD: 'https://bookhushly.com/dashboard/customer',
  openWeb: (url: string) => {
    mockOpenWeb(url);
  },
}));
type Removal = { preventDefault: jest.Mock };
const mockListeners = new Map<string, (e: Removal) => void>();
jest.mock('expo-router', () => ({
  useNavigation: () => mockNavigation,
}));
const mockNavigation = {
  addListener: (name: string, cb: (e: Removal) => void) => {
    mockListeners.set(name, cb);
    return () => {
      if (mockListeners.get(name) === cb) mockListeners.delete(name);
    };
  },
};

const mockPayment = jest.mocked(usePayment);
const mockBooking = jest.mocked(useBooking);
const mockCharge = jest.mocked(useServiceCharge);

const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';
const CREATED = '2026-10-21T09:00:00Z';

const HOTEL_ROW = hotelBookingRow.parse({
  id: ID,
  check_in_date: '2026-10-24',
  check_out_date: '2026-10-27',
  adults: 2,
  children: 0,
  payment_status: 'pending',
  total_amount: 100000,
  booking_status: 'confirmed',
  checked_in: false,
  checked_in_at: null,
  checked_out_at: null,
  check_in_code: null,
  created_at: CREATED,
  hotel: {
    id: 'h1',
    name: 'Harbour Suites',
    city: 'Lagos',
    state: 'Lagos',
    address: null,
    image_urls: null,
    check_in_time: '14:00',
    check_out_time: null,
  },
  room_type: { id: 'rt1', name: 'Deluxe king' },
});

const EVENT_ROW = eventBookingRow.parse({
  id: ID,
  status: 'pending',
  payment_status: 'pending',
  total_amount: 20000,
  booking_date: '2026-10-21',
  booking_time: null,
  guests: 2,
  ticket_details: { VIP: 2 },
  seat_assignments: null,
  created_at: CREATED,
  listing: {
    id: 'l1',
    title: 'Lagos Jazz Night',
    location: null,
    media_urls: null,
    event_date: '2026-10-30T00:00:00',
    event_end_date: null,
    event_time: '2026-10-30T18:00:00+00:00',
    require_dynamic_ticket: null,
  },
  tickets: [],
});

const ENTRY: CheckoutEntry = {
  userId: 'u1',
  kind: 'hotel',
  bookingId: ID,
  listingId: 'h1',
  title: 'Harbour Suites',
  createdAt: CREATED,
  total: 100000,
  pricing: { room_total: 100000, airport_fee: 0, breakfast_total: 0, discount_amount: 0 },
  summary: { checkIn: '2026-10-24', checkOut: '2026-10-27', guests: 2, roomName: 'Deluxe king' },
  guestEmail: 'ada.lovelace@example.com',
  payment: null,
  paymentEverStarted: false,
};

type Pay = ReturnType<typeof usePayment>;
let pay: Pay;

function setPayment(state: FlowState, over: Partial<Pay> = {}) {
  pay = {
    state,
    pay: jest.fn(),
    retry: jest.fn(),
    checkAgain: jest.fn(),
    leave: jest.fn(),
    willCancelOnLeave: true,
    holdEndsAt: null,
    canPay: true,
    recentAttempt: false,
    entry: null,
    ...over,
  };
  mockPayment.mockImplementation(() => pay);
}

function setCharge(q: {
  data?: unknown;
  isPending?: boolean;
  isError?: boolean;
  fetchStatus?: 'fetching' | 'paused' | 'idle';
  failureCount?: number;
}) {
  mockCharge.mockReturnValue({
    isPending: false,
    isError: false,
    fetchStatus: 'idle',
    failureCount: 0,
    ...q,
  } as unknown as ReturnType<typeof useServiceCharge>);
}

function setRow(row: unknown, error = false) {
  mockBooking.mockImplementation(
    () =>
      ({
        row,
        fromWallet: null,
        savedAt: null,
        today: '2026-10-21',
        error,
        refetch: jest.fn(),
      }) as unknown as ReturnType<typeof useBooking>,
  );
}

const handlers = {
  onBack: jest.fn(),
  onBookings: jest.fn(),
  onStartAgain: jest.fn(),
  onViewTickets: jest.fn(),
  onViewBooking: jest.fn(),
  onDone: jest.fn(),
};

async function renderPay(
  kind: 'hotel' | 'event',
  opts: { free?: boolean; fromSelect?: boolean } = {},
) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={qc}>
      <PayScreen
        booking={{ kind, id: ID }}
        free={opts.free ?? false}
        fromSelect={opts.fromSelect ?? true}
        userId="u1"
        email="signed.in@example.com"
        {...handlers}
      />
    </QueryClientProvider>,
  );
}

function removeScreen(): Removal {
  const e = { preventDefault: jest.fn() };
  mockListeners.get('beforeRemove')?.(e);
  return e;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockListeners.clear();
  mockFlags.payments = true;
  setCharge({
    data: { charge_type: 'percentage', charge_value: 2.5, enabled: true, label: null },
  });
  setRow(HOTEL_ROW);
  setPayment({ step: 'review' });
});

it('review shows the server total and a Pay label that includes the service charge', async () => {
  setPayment({ step: 'review' }, { entry: ENTRY });
  await renderPay('hotel');
  expect(screen.getByText('Room')).toBeTruthy();
  expect(screen.getByText('Service charge (estimate)')).toBeTruthy();
  expect(screen.getByText('₦2,500')).toBeTruthy();
  expect(screen.getByText('₦102,500')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Pay ₦102,500' })).toBeTruthy();
  expect(screen.getByText(/Paystack’s secure page/)).toBeTruthy();
  expect(screen.getByText('ada.lovelace@example.com')).toBeTruthy();
  // The booking row's title and total go to the hook (entry written when none is cached).
  expect(mockPayment).toHaveBeenCalledWith('u1', 'hotel', ID, {
    createdAt: CREATED,
    email: 'signed.in@example.com',
    title: 'Harbour Suites',
    total: 100000,
    rowState: 'unpaid',
    fromSelect: true,
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Pay ₦102,500' }));
  expect(pay.pay).toHaveBeenCalledTimes(1);
});

it('total-only layout without cached pricing', async () => {
  setCharge({ data: null });
  await renderPay('hotel');
  expect(screen.getByText('Booking total')).toBeTruthy();
  expect(screen.queryByText('Room')).toBeNull();
  expect(screen.queryByText(/Service charge/)).toBeNull();
  expect(screen.getByRole('button', { name: 'Pay ₦100,000' })).toBeTruthy();
});

it('the hold line shows for a hotel', async () => {
  setPayment({ step: 'review' }, { holdEndsAt: Date.parse('2026-10-21T09:25:00Z') });
  await renderPay('hotel');
  expect(screen.getByText('We’re holding this for you until 10:25 am')).toBeTruthy();
});

it('no hold line for an event, even if the hook reports a hold end', async () => {
  setRow(EVENT_ROW);
  setPayment({ step: 'review' }, { holdEndsAt: Date.parse('2026-10-21T09:25:00Z') });
  await renderPay('event');
  expect(screen.queryByTestId('pay-hold')).toBeNull();
  expect(screen.getByText('Lagos Jazz Night')).toBeTruthy();
  expect(screen.getByText('Fri 30 Oct · 7:00 pm')).toBeTruthy();
});

it('Pay is off until the stay is payable', async () => {
  setPayment({ step: 'review' }, { canPay: false });
  await renderPay('hotel');
  expect(screen.getByRole('button', { name: 'Pay ₦102,500' })).toBeDisabled();
});

it('hold ended swaps Pay for Start again', async () => {
  setPayment({ step: 'holdEnded' });
  await renderPay('hotel');
  expect(screen.queryByTestId('pay-button')).toBeNull();
  expect(screen.getByText('This hold has ended. Start again to book these dates.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Start again' }));
  expect(handlers.onStartAgain).toHaveBeenCalledWith({
    kind: 'hotel',
    listingId: 'h1',
    roomTypeId: 'rt1',
  });
});

it('checking blocks back and has nothing to press', async () => {
  const back: { handler?: () => boolean | null | undefined } = {};
  const spy = jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, handler) => {
    back.handler = () => handler({ type: 'hardwareBackPress', timeStamp: 0 });
    return { remove: jest.fn() };
  });
  setPayment({
    step: 'checking',
    reference: 'r1',
    paymentStartedAt: 0,
    startedAt: 0,
    attempt: 0,
    nextDelayMs: 2000,
  });
  await renderPay('hotel');
  expect(screen.getByText('Checking your payment')).toBeTruthy();
  expect(screen.getByText('This can take a few minutes')).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(back.handler?.()).toBe(true);
  expect(removeScreen().preventDefault).toHaveBeenCalled();
  expect(pay.leave).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('failed never says you weren’t charged; Try again goes back to Review (A1c, A1d)', async () => {
  setPayment({ step: 'failed', reference: 'r1' });
  await renderPay('hotel');
  expect(screen.getByText('Payment didn’t go through.')).toBeTruthy();
  expect(
    screen.getByText(
      'If money left your account, it’ll be confirmed or refunded — check Bookings.',
    ),
  ).toBeTruthy();
  expect(screen.queryByText(/weren’t charged/)).toBeNull();
  expect(mockCue).toHaveBeenCalledWith('error');
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(pay.retry).toHaveBeenCalledTimes(1);
  expect(pay.pay).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Go to Bookings' }));
  expect(handlers.onBookings).toHaveBeenCalledTimes(1);
});

it('an unconfirmed payment says it may take minutes; Check again or Go to Bookings (A1b)', async () => {
  setPayment({ step: 'unconfirmed', reference: 'r1', paymentStartedAt: 0 });
  await renderPay('hotel');
  expect(screen.getByText('We couldn’t confirm this payment yet.')).toBeTruthy();
  expect(
    screen.getByText(
      'If you paid by bank transfer or USSD it can take a few minutes. Check Bookings before paying again.',
    ),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(pay.checkAgain).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Go to Bookings' }));
  expect(handlers.onBookings).toHaveBeenCalledTimes(1);
  expect(mockCue).not.toHaveBeenCalled();
});

it('still checking offers Check again', async () => {
  setPayment({ step: 'stillChecking', reference: 'r1', paymentStartedAt: 0 });
  await renderPay('hotel');
  expect(
    screen.getByText('We’re still checking. If you paid, it’ll show in Bookings shortly.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(pay.checkAgain).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: 'Go to Bookings' })).toBeTruthy();
});

it('a payment open elsewhere offers Check again', async () => {
  setPayment({ step: 'pendingElsewhere' });
  await renderPay('hotel');
  expect(screen.getByText('A payment for this booking is still open.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(pay.checkAgain).toHaveBeenCalledTimes(1);
});

it('done shows View tickets for an event', async () => {
  setRow(EVENT_ROW);
  setPayment({ step: 'done', reference: 'r1' });
  await renderPay('event');
  expect(screen.getByText('You’re booked')).toBeTruthy();
  expect(screen.getByText('Confirmation sent to s•••n@example.com')).toBeTruthy();
  expect(mockCue).toHaveBeenCalledWith('success');
  await fireEvent.press(screen.getByRole('button', { name: 'View tickets' }));
  expect(handlers.onViewTickets).toHaveBeenCalledWith(ID);
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(handlers.onDone).toHaveBeenCalledTimes(1);
});

it('done shows View booking for a hotel, to the guest email', async () => {
  setPayment({ step: 'done', reference: 'r1' }, { entry: ENTRY });
  await renderPay('hotel');
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByText('24–27 Oct · 3 nights')).toBeTruthy();
  expect(screen.getByText('Confirmation sent to a•••e@example.com')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'View booking' }));
  expect(handlers.onViewBooking).toHaveBeenCalledWith('hotel', ID);
});

it('a cancelled booking shows it was cancelled, with Go to Bookings and no Pay (A2b)', async () => {
  setRow(hotelBookingRow.parse({ ...HOTEL_ROW, booking_status: 'cancelled' }));
  await renderPay('hotel');
  expect(screen.getByText('This booking was cancelled.')).toBeTruthy();
  expect(screen.queryByTestId('pay-button')).toBeNull();
  expect(mockPayment).toHaveBeenCalledWith(
    'u1',
    'hotel',
    ID,
    expect.objectContaining({ rowState: 'cancelled' }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Go to Bookings' }));
  expect(handlers.onBookings).toHaveBeenCalledTimes(1);
});

it('a row that already reads paid is Done, and the entry is dropped (A2b)', async () => {
  setRow(hotelBookingRow.parse({ ...HOTEL_ROW, payment_status: 'completed' }));
  await renderPay('hotel');
  expect(screen.getByText('You’re booked')).toBeTruthy();
  expect(screen.queryByTestId('pay-button')).toBeNull();
  expect(mockDrop).toHaveBeenCalledWith('u1', 'hotel', ID);
});

it('a recent payment attempt warns above Pay (A1d)', async () => {
  setPayment({ step: 'review' }, { recentAttempt: true });
  await renderPay('hotel');
  expect(
    screen.getByText(
      'If you already paid by bank transfer or USSD, wait a few minutes — paying again could charge you twice.',
    ),
  ).toBeTruthy();
  setPayment({ step: 'review' }, { recentAttempt: false });
  await renderPay('hotel');
  expect(screen.queryByTestId('pay-recent-attempt')).toBeNull();
});

it('passes whether Review was reached from Select to the hook (A2a)', async () => {
  await renderPay('hotel', { fromSelect: false });
  expect(mockPayment).toHaveBeenCalledWith(
    'u1',
    'hotel',
    ID,
    expect.objectContaining({ fromSelect: false }),
  );
});

it('back from review calls leave', async () => {
  await renderPay('hotel');
  const e = removeScreen();
  expect(e.preventDefault).not.toHaveBeenCalled();
  expect(pay.leave).toHaveBeenCalledTimes(1);
});

it('Cancel booking leaves once, then goes back', async () => {
  await renderPay('hotel');
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel booking' }));
  expect(pay.leave).toHaveBeenCalledTimes(1);
  expect(handlers.onBack).toHaveBeenCalledTimes(1);
  // The removal that follows doesn't cancel twice.
  removeScreen();
  expect(pay.leave).toHaveBeenCalledTimes(1);
});

it('a 503 start error reads try-again words, and Try again re-runs Pay', async () => {
  setPayment({
    step: 'startError',
    words: 'Couldn’t start payment. Try again',
    action: 'tryAgain',
  });
  await renderPay('hotel');
  expect(screen.getByText('Couldn’t start payment. Try again')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(pay.checkAgain).toHaveBeenCalledTimes(1);
});

it('a price that could not be confirmed offers Start again', async () => {
  setPayment({
    step: 'startError',
    words: 'This booking’s price couldn’t be confirmed. Start again',
    action: 'startAgain',
  });
  await renderPay('hotel');
  await fireEvent.press(screen.getByRole('button', { name: 'Start again' }));
  expect(handlers.onStartAgain).toHaveBeenCalledWith({
    kind: 'hotel',
    listingId: 'h1',
    roomTypeId: 'rt1',
  });
});

it('a refusal has no button beside its words', async () => {
  setPayment({ step: 'startError', words: 'Booking not found', action: null });
  await renderPay('hotel');
  expect(screen.getByText('Booking not found')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Start again' })).toBeNull();
});

const FREE_ROW = eventBookingRow.parse({
  ...EVENT_ROW,
  status: 'confirmed',
  payment_status: 'completed',
  total_amount: 0,
});

it('free=1 shows Done once the row says paid, and never cancels on leaving', async () => {
  setRow(FREE_ROW);
  await renderPay('event', { free: true });
  expect(screen.getByText('You’re booked')).toBeTruthy();
  expect(mockCue).toHaveBeenCalledWith('success');
  expect(mockDrop).toHaveBeenCalledWith('u1', 'event', ID);
  removeScreen();
  expect(pay.leave).not.toHaveBeenCalled();
});

it('free=1 waits for the row before saying anything', async () => {
  setRow(undefined);
  await renderPay('event', { free: true });
  expect(screen.queryByText('You’re booked')).toBeNull();
  expect(screen.queryByTestId('pay-button')).toBeNull();
  expect(mockCue).not.toHaveBeenCalled();
  expect(mockDrop).not.toHaveBeenCalled();
});

it.each(['pending', 'failed'] as const)(
  'free=1 on a %s booking is reviewed, never booked',
  async (status) => {
    setRow(eventBookingRow.parse({ ...EVENT_ROW, payment_status: status }));
    await renderPay('event', { free: true });
    expect(screen.queryByText('You’re booked')).toBeNull();
    expect(screen.getByTestId('pay-button')).toBeTruthy();
    expect(mockDrop).not.toHaveBeenCalled();
    expect(mockCue).not.toHaveBeenCalled();
  },
);

it('free=1 on a null payment status is reviewed, never booked', async () => {
  setRow(eventBookingRow.parse({ ...EVENT_ROW, payment_status: null }));
  await renderPay('event', { free: true });
  expect(screen.queryByText('You’re booked')).toBeNull();
  expect(mockDrop).not.toHaveBeenCalled();
});

it('free=1 on a booking not on this account reads Booking not found', async () => {
  setRow(null);
  await renderPay('event', { free: true });
  expect(screen.getByText('Booking not found')).toBeTruthy();
  expect(screen.queryByText('You’re booked')).toBeNull();
  expect(mockDrop).not.toHaveBeenCalled();
});

it('payments switched off keep the web hand-off in place of Pay', async () => {
  mockFlags.payments = false;
  await renderPay('hotel');
  expect(screen.queryByTestId('pay-button')).toBeNull();
  expect(screen.getByText('Finish paying on bookhushly.com')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Pay on bookhushly.com' }));
  expect(mockOpenWeb).toHaveBeenCalledWith('https://bookhushly.com/dashboard/customer');
});

it('payments switched off still show Checking and Check again', async () => {
  mockFlags.payments = false;
  setPayment({ step: 'stillChecking', reference: 'r1', paymentStartedAt: 0 });
  await renderPay('hotel');
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(pay.checkAgain).toHaveBeenCalledTimes(1);
});

it('payments switched on show Pay, not the hand-off', async () => {
  await renderPay('hotel');
  expect(screen.getByTestId('pay-button')).toBeTruthy();
  expect(screen.queryByText('Finish paying on bookhushly.com')).toBeNull();
});

it('Not now replaces Cancel booking when leaving would not cancel', async () => {
  setPayment({ step: 'review' }, { willCancelOnLeave: false });
  await renderPay('hotel');
  expect(screen.queryByRole('button', { name: 'Cancel booking' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Not now' }));
  expect(handlers.onBack).toHaveBeenCalledTimes(1);
  expect(pay.leave).not.toHaveBeenCalled();
});

it('Pay waits while the service charge loads', async () => {
  setCharge({ isPending: true, fetchStatus: 'fetching' });
  await renderPay('hotel');
  expect(screen.getByTestId('pay-button')).toBeDisabled();
  expect(screen.queryByText('Checking the service charge…')).toBeNull();
});

it('offline, the paused charge read says why Pay waits', async () => {
  setCharge({ isPending: true, fetchStatus: 'paused' });
  await renderPay('hotel');
  expect(screen.getByText('Checking the service charge…')).toBeTruthy();
  expect(screen.getByTestId('pay-button')).toBeDisabled();
});

it('a charge read retrying after a failure says why Pay waits', async () => {
  setCharge({ isPending: true, fetchStatus: 'fetching', failureCount: 1 });
  await renderPay('hotel');
  expect(screen.getByText('Checking the service charge…')).toBeTruthy();
  expect(screen.getByTestId('pay-button')).toBeDisabled();
});

it('backing out while a free registration loads never cancels it', async () => {
  setRow(undefined);
  await renderPay('event', { free: true });
  removeScreen();
  expect(pay.leave).not.toHaveBeenCalled();
});

it('backing out after a free registration failed to load never cancels it', async () => {
  setRow(undefined, true);
  await renderPay('event', { free: true });
  expect(screen.getByText('Couldn’t load this booking')).toBeTruthy();
  removeScreen();
  expect(pay.leave).not.toHaveBeenCalled();
});

it('a failed service charge read shows the total with a note, and Pay works', async () => {
  setCharge({ isError: true });
  await renderPay('hotel');
  expect(screen.getByText('plus any service charge shown on Paystack')).toBeTruthy();
  const button = screen.getByRole('button', { name: 'Pay ₦100,000' });
  expect(button).toBeEnabled();
});

it('off-shape params read Booking not found', async () => {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <PayScreen
        booking={null}
        free={false}
        fromSelect={false}
        userId="u1"
        email=""
        {...handlers}
      />
    </QueryClientProvider>,
  );
  expect(screen.getByText('Booking not found')).toBeTruthy();
});
