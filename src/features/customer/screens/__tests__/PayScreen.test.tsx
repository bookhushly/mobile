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
    checkAgain: jest.fn(),
    leave: jest.fn(),
    holdEndsAt: null,
    canPay: true,
    entry: null,
    ...over,
  };
  mockPayment.mockImplementation(() => pay);
}

function setRow(row: unknown) {
  mockBooking.mockImplementation(
    () =>
      ({
        row,
        fromWallet: null,
        savedAt: null,
        today: '2026-10-21',
        error: false,
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

async function renderPay(kind: 'hotel' | 'event', opts: { free?: boolean } = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await render(
    <QueryClientProvider client={qc}>
      <PayScreen
        booking={{ kind, id: ID }}
        free={opts.free ?? false}
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
  mockCharge.mockReturnValue({
    data: { charge_type: 'percentage', charge_value: 2.5, enabled: true, label: null },
  } as unknown as ReturnType<typeof useServiceCharge>);
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
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Pay ₦102,500' }));
  expect(pay.pay).toHaveBeenCalledTimes(1);
});

it('total-only layout without cached pricing', async () => {
  mockCharge.mockReturnValue({ data: null } as unknown as ReturnType<typeof useServiceCharge>);
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

it('no hold line for an event', async () => {
  setRow(EVENT_ROW);
  setPayment({ step: 'review' });
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
    startedAt: 0,
    attempt: 0,
    nextDelayMs: 2000,
  });
  await renderPay('hotel');
  expect(screen.getByText('Checking your payment')).toBeTruthy();
  expect(screen.getByText('This can take up to a minute')).toBeTruthy();
  expect(screen.queryAllByRole('button')).toHaveLength(0);
  expect(back.handler?.()).toBe(true);
  expect(removeScreen().preventDefault).toHaveBeenCalled();
  expect(pay.leave).not.toHaveBeenCalled();
  spy.mockRestore();
});

it('failed says you weren’t charged and offers Try again', async () => {
  setPayment({ step: 'failed' });
  await renderPay('hotel');
  expect(screen.getByText('Payment didn’t go through. You weren’t charged.')).toBeTruthy();
  expect(mockCue).toHaveBeenCalledWith('error');
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(pay.pay).toHaveBeenCalledTimes(1);
  await fireEvent.press(screen.getByRole('button', { name: 'Go to Bookings' }));
  expect(handlers.onBookings).toHaveBeenCalledTimes(1);
});

it('still checking offers Check again', async () => {
  setPayment({ step: 'stillChecking', reference: 'r1' });
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
  setPayment({ step: 'done' });
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
  setPayment({ step: 'done' }, { entry: ENTRY });
  await renderPay('hotel');
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByText('24–27 Oct · 3 nights')).toBeTruthy();
  expect(screen.getByText('Confirmation sent to a•••e@example.com')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'View booking' }));
  expect(handlers.onViewBooking).toHaveBeenCalledWith('hotel', ID);
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
  setPayment({ step: 'startError', words: 'Couldn’t start payment. Try again' });
  await renderPay('hotel');
  expect(screen.getByText('Couldn’t start payment. Try again')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(pay.checkAgain).toHaveBeenCalledTimes(1);
});

it('free=1 shows Done directly and never cancels on leaving', async () => {
  setRow(undefined);
  await renderPay('event', { free: true });
  expect(screen.getByText('You’re booked')).toBeTruthy();
  expect(mockDrop).toHaveBeenCalledWith('u1', 'event', ID);
  removeScreen();
  expect(pay.leave).not.toHaveBeenCalled();
});

it('off-shape params read Booking not found', async () => {
  await render(
    <QueryClientProvider client={new QueryClient()}>
      <PayScreen booking={null} free={false} userId="u1" email="" {...handlers} />
    </QueryClientProvider>,
  );
  expect(screen.getByText('Booking not found')).toBeTruthy();
});
