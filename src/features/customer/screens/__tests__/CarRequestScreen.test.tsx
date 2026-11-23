import { fireEvent, render, screen } from '@testing-library/react-native';

import { useCarActions, useCarReview } from '@/features/customer/hooks/useCarActions';
import { useCarDraft } from '@/features/customer/hooks/useCarDraft';
import { useCarPayment, usePayOnOpen } from '@/features/customer/hooks/useCarPayment';
import { useCarRequest } from '@/features/customer/hooks/useCarRequests';
import type { CarOffer, CarRequest } from '@/features/customer/schemas/carRental';
import { CarQuoteScreen } from '@/features/customer/screens/CarQuoteScreen';
import { CarRequestScreen } from '@/features/customer/screens/CarRequestScreen';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/features/customer/hooks/useCarRequests', () => ({ useCarRequest: jest.fn() }));
jest.mock('@/features/customer/hooks/useCarActions', () => ({
  useCarActions: jest.fn(),
  useCarReview: jest.fn(),
}));
jest.mock('@/features/customer/hooks/useCarPayment', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/features/customer/hooks/useCarPayment'),
  useCarPayment: jest.fn(),
}));
jest.mock('@/features/customer/offline/carPayStore', () => ({ carPayStore: {} }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-01T10:00:00Z');

const mockRequest = jest.mocked(useCarRequest);
const mockActions = jest.mocked(useCarActions);
const mockPayment = jest.mocked(useCarPayment);

const offer = (over: Partial<CarOffer>): CarOffer => ({
  id: 'o1',
  amount: 114000,
  message: 'Full tank.',
  pricingModel: null,
  status: 'pending',
  expiresAt: null,
  imageUrls: [],
  vendor: { id: 'v1', name: 'Ikeja Car Hire', rating: 4.6, reviewCount: 22 },
  vehicle: {
    make: 'Toyota',
    model: 'Camry',
    year: 2019,
    seats: 5,
    type: 'sedan',
    imageUrls: [],
    verified: true,
    plate: null,
  },
  driver: { name: 'Tunde A.', years: 9, photoUrl: null, verified: true },
  ...over,
});

const request = (over: Partial<CarRequest>): CarRequest => ({
  id: 'r1',
  status: 'open',
  tripType: 'chauffeur',
  vehicleType: 'sedan',
  pickupState: 'Lagos',
  pickupAddress: 'Allen Avenue',
  destinationState: null,
  destinationAddress: null,
  pickupDate: '2026-12-04',
  returnDate: '2026-12-06',
  pickupTime: '09:00',
  passengers: 4,
  purpose: null,
  notes: null,
  pricingModel: null,
  urgent: false,
  expiresAt: '2026-12-04T13:00:00Z',
  createdAt: '2026-12-01T09:00:00Z',
  vendorCompletedAt: null,
  offerCount: 0,
  selectedVendor: null,
  selectedOffer: null,
  offers: [],
  ...over,
});

let actions: { select: jest.Mock; cancel: jest.Mock; confirmDone: jest.Mock; busy: null };
let pay: {
  state: { kind: 'idle' };
  pay: jest.Mock;
  checkAgain: jest.Mock;
  paymentOpen: jest.Mock;
};

function show(r: CarRequest) {
  mockRequest.mockReturnValue({
    request: r,
    loading: false,
    failed: false,
    error: null,
    refetch: jest.fn(() => Promise.resolve()),
    isStale: false,
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  actions = {
    select: jest.fn(() => Promise.resolve({ kind: 'ok', value: {} })),
    cancel: jest.fn(() => Promise.resolve({ kind: 'ok', value: { refund: 'none' } })),
    confirmDone: jest.fn(() => Promise.resolve({ kind: 'ok', value: {} })),
    busy: null,
  };
  mockActions.mockReturnValue(actions);
  jest.mocked(useCarReview).mockReturnValue({
    state: { kind: 'idle' },
    post: jest.fn(),
    reset: jest.fn(),
  });
  pay = {
    state: { kind: 'idle' },
    pay: jest.fn(),
    checkAgain: jest.fn(),
    paymentOpen: jest.fn(() => Promise.resolve('clear')),
  };
  mockPayment.mockReturnValue(pay);
});

const screenFor = (over: Partial<Parameters<typeof CarRequestScreen>[0]> = {}) => (
  <CarRequestScreen
    userId="u1"
    id="r1"
    onBack={jest.fn()}
    onSeeQuotes={jest.fn()}
    onAskAgain={jest.fn()}
    {...over}
  />
);

describe('CarRequestScreen', () => {
  it('waiting: says where it went, the real deadline, and offers to cancel', async () => {
    show(request({}));
    await render(screenFor());
    expect(screen.getByText('Your request is out')).toBeTruthy();
    expect(screen.getByText('Open until Fri 4 Dec, 2:00 pm')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('car-cancel'));
    await fireEvent.press(screen.getByTestId('car-cancel-confirm'));
    expect(actions.cancel).toHaveBeenCalledWith('');
  });

  it('quotes: the count and range, then one next step', async () => {
    const onSeeQuotes = jest.fn();
    show(
      request({
        offerCount: 2,
        offers: [offer({ id: 'a', amount: 156000 }), offer({ id: 'b', amount: 114000 })],
      }),
    );
    await render(screenFor({ onSeeQuotes }));
    expect(
      screen.getByText('From ₦114,000 for the 3 days. More may come until Fri 4 Dec, 2:00 pm.'),
    ).toBeTruthy();
    expect(screen.getByText('₦114,000 to ₦156,000')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'See 2 quotes' }));
    expect(onSeeQuotes).toHaveBeenCalled();
  });

  it('no quotes: nothing charged, and Ask again keeps the answers with the change', async () => {
    const onAskAgain = jest.fn();
    show(request({ status: 'expired' }));
    await render(screenFor({ onAskAgain }));
    expect(screen.getByText(/Nothing was charged/)).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Any car' }));
    await fireEvent.press(screen.getByTestId('car-ask-again'));
    expect(onAskAgain).toHaveBeenCalled();
    const s = useCarDraft.getState();
    expect(s.step).toBe('check');
    expect(s.draft).toMatchObject({
      vehicleType: null,
      pickupState: 'Lagos',
      pickupDate: '2026-12-04',
    });
  });

  it('chosen: Pay shows the quote’s amount, and opens checkout once when asked to', async () => {
    show(
      request({
        status: 'matched',
        selectedVendor: { id: 'v1', name: 'Ikeja Car Hire', phone: null },
        selectedOffer: offer({}),
      }),
    );
    usePayOnOpen.getState().ask('r1');
    await render(screenFor());
    expect(pay.pay).toHaveBeenCalledTimes(1);
    await fireEvent.press(screen.getByRole('button', { name: 'Pay ₦114,000' }));
    expect(pay.pay).toHaveBeenCalledTimes(2);
  });

  it('while a payment may be under way, Cancel is not offered', async () => {
    mockPayment.mockReturnValue({ ...pay, state: { kind: 'notYet' } });
    show(
      request({
        status: 'matched',
        selectedVendor: { id: 'v1', name: 'Ikeja Car Hire', phone: null },
        selectedOffer: offer({}),
      }),
    );
    await render(screenFor());
    expect(screen.getByTestId('car-check-again')).toBeTruthy();
    expect(screen.queryByTestId('car-cancel')).toBeNull();
  });

  it('cancelling a paid booking says the refund has started', async () => {
    actions.cancel.mockResolvedValueOnce({ kind: 'ok', value: { refund: 'pending' } });
    show(
      request({
        status: 'paid',
        selectedVendor: { id: 'v1', name: 'Ikeja Car Hire', phone: null },
        selectedOffer: offer({}),
      }),
    );
    await render(screenFor());
    await fireEvent.press(screen.getByRole('button', { name: 'Cancel booking' }));
    await fireEvent.press(screen.getByTestId('car-cancel-confirm'));
    expect(screen.getByText('Cancelled. A refund of your payment has been started.')).toBeTruthy();
  });

  it('booked: the car, pick-up with Directions and Call, and confirm only once the company marks it done', async () => {
    show(
      request({
        status: 'in_progress',
        selectedVendor: { id: 'v1', name: 'Ikeja Car Hire', phone: '+2348011111111' },
        selectedOffer: offer({}),
      }),
    );
    await render(screenFor());
    expect(screen.getByText('Toyota Camry 2019')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Directions' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Call Ikeja Car Hire' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Confirm trip’s done' })).toBeDisabled();
    expect(screen.getByText('Available once Ikeja Car Hire marks the trip done')).toBeTruthy();
  });

  it('a request that is not yours, or gone, says so without a retry loop', async () => {
    mockRequest.mockReturnValue({
      request: null,
      loading: false,
      failed: true,
      error: { kind: 'notFound' },
      refetch: jest.fn(() => Promise.resolve()),
      isStale: false,
    });
    await render(screenFor());
    expect(screen.getByText('This request wasn’t found')).toBeTruthy();
  });
});

describe('CarQuoteScreen', () => {
  it('shows the car first, then confirms and chooses the quote', async () => {
    const onChosen = jest.fn();
    show(request({ offerCount: 2, offers: [offer({}), offer({ id: 'o2', amount: 150000 })] }));
    await render(
      <CarQuoteScreen userId="u1" id="r1" offerId="o1" onBack={jest.fn()} onChosen={onChosen} />,
    );
    expect(screen.getByText('3 days · ₦38,000 a day')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('car-choose'));
    expect(screen.getByText(/The other quote will be declined/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('car-choose-confirm'));
    expect(actions.select).toHaveBeenCalledWith('o1');
    expect(onChosen).toHaveBeenCalled();
  });

  it('a quote taken by then says so, and keeps the sheet open', async () => {
    actions.select.mockResolvedValueOnce({ kind: 'refused', code: 'offer_unavailable' });
    const onChosen = jest.fn();
    show(request({ offerCount: 1, offers: [offer({})] }));
    await render(
      <CarQuoteScreen userId="u1" id="r1" offerId="o1" onBack={jest.fn()} onChosen={onChosen} />,
    );
    await fireEvent.press(screen.getByTestId('car-choose'));
    await fireEvent.press(screen.getByTestId('car-choose-confirm'));
    expect(
      screen.getByText('That quote isn’t available any more. Choose another one.'),
    ).toBeTruthy();
    expect(onChosen).not.toHaveBeenCalled();
  });
});
