import { fireEvent, render, screen } from '@testing-library/react-native';

import type { CarOffer } from '@/features/customer/schemas/carRental';
import type { LogisticsRequest } from '@/features/customer/schemas/logistics';
import { LogisticsRequestScreen } from '@/features/customer/screens/LogisticsRequestScreen';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
const mockOne = jest.fn();
const mockActions = jest.fn();
const mockPayment = jest.fn();
jest.mock('@/features/customer/hooks/useCarRequests', () => ({
  useRfqRequest: (): unknown => mockOne(),
}));
jest.mock('@/features/customer/hooks/useCarActions', () => ({
  useRfqActions: (): unknown => mockActions(),
  useRfqReview: () => ({ state: { kind: 'idle' }, post: jest.fn(), reset: jest.fn() }),
}));
jest.mock('@/features/customer/hooks/useCarPayment', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/features/customer/hooks/useCarPayment'),
  useRfqPayment: (): unknown => mockPayment(),
}));
jest.mock('@/features/customer/offline/carPayStore', () => ({ carPayStore: {} }));
jest.mock('@/features/customer/hooks/useCheckoutData', () => ({
  useServiceCharge: () => mockCharge(),
}));
const mockCharge = jest.fn((): { data: unknown } => ({ data: null }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-04T15:00:00Z');

const offer: CarOffer = {
  id: 'o1',
  amount: 52000,
  message: null,
  pricingModel: null,
  status: 'accepted',
  expiresAt: null,
  imageUrls: [],
  vendor: { id: 'v1', name: 'Swift Dispatch', rating: 4.7, reviewCount: 12 },
  vehicle: null,
  driver: null,
};

const request = (over: Partial<LogisticsRequest>): LogisticsRequest => ({
  id: 'l1',
  status: 'in_progress',
  serviceType: 'delivery',
  pickupAddress: '12 Allen Avenue',
  pickupLandmark: null,
  pickupState: 'Lagos',
  pickupDate: '2026-12-04',
  pickupTime: '10:00',
  deliveryAddress: '4 Aminu Kano Crescent',
  deliveryLandmark: null,
  deliveryState: 'FCT',
  deliveryDate: null,
  itemDescription: 'Books',
  itemCategory: null,
  itemWeight: null,
  quantity: 1,
  vehicleType: 'van',
  fragile: false,
  perishable: false,
  packaging: false,
  insurance: false,
  notes: null,
  expiresAt: null,
  createdAt: '2026-12-01T10:00:00Z',
  vendorCompletedAt: null,
  pickedUpAt: '2026-12-04T09:20:00Z',
  inTransitAt: '2026-12-04T10:05:00Z',
  deliveredAt: null,
  proofUrl: null,
  offerCount: 0,
  selectedVendor: { id: 'v1', name: 'Swift Dispatch', phone: '+2348022222222' },
  selectedOffer: offer,
  offers: [],
  ...over,
});

let actions: { busy: null; select: jest.Mock; cancel: jest.Mock; confirmDone: jest.Mock };

function show(r: LogisticsRequest) {
  mockOne.mockReturnValue({
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
    busy: null,
    select: jest.fn(),
    cancel: jest.fn(() => Promise.resolve({ kind: 'ok', value: { refund: 'none' } })),
    confirmDone: jest.fn(() => Promise.resolve({ kind: 'ok', value: undefined })),
  };
  mockActions.mockReturnValue(actions);
  mockPayment.mockReturnValue({
    state: { kind: 'idle' },
    pay: jest.fn(),
    checkAgain: jest.fn(),
    paymentOpen: jest.fn(() => Promise.resolve('clear')),
  });
});

const screenFor = () => (
  <LogisticsRequestScreen
    userId="u1"
    id="l1"
    onBack={jest.fn()}
    onSeeQuotes={jest.fn()}
    onAskAgain={jest.fn()}
  />
);

it('on the way: tracking with the times, Call, and confirm waits for the company', async () => {
  show(request({}));
  await render(screenFor());
  expect(screen.getByText('It’s on the way')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Call Swift Dispatch' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Confirm it arrived' })).toBeDisabled();
  expect(screen.getByText('Available once Swift Dispatch marks it delivered')).toBeTruthy();
});

it('delivered: the company marked it, so the customer can confirm it arrived', async () => {
  show(request({ deliveredAt: '2026-12-04T14:40:00Z', vendorCompletedAt: '2026-12-04T14:41:00Z' }));
  await render(screenFor());
  expect(screen.getByText('It’s been delivered')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm it arrived' }));
  expect(actions.confirmDone).toHaveBeenCalled();
});

it('cancelling a waiting request needs a reason (the web refuses an empty one)', async () => {
  show(
    request({
      status: 'open',
      selectedOffer: null,
      selectedVendor: null,
      pickedUpAt: null,
      inTransitAt: null,
    }),
  );
  await render(screenFor());
  expect(screen.getByText('Your request is out')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('car-cancel'));
  expect(screen.getByTestId('car-cancel-confirm')).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Why are you cancelling?'), 'Plans changed');
  await fireEvent.press(screen.getByTestId('car-cancel-confirm'));
  expect(actions.cancel).toHaveBeenCalledWith('Plans changed');
});

it('a chosen quote: Pay shows the total with the service charge, and says so', async () => {
  mockCharge.mockReturnValueOnce({
    data: { charge_type: 'percentage', charge_value: 5, enabled: true, label: 'Service charge' },
  });
  show(
    request({
      status: 'matched',
      pickedUpAt: null,
      inTransitAt: null,
      selectedVendor: { id: 'v1', name: 'Swift Dispatch', phone: null },
    }),
  );
  await render(screenFor());
  expect(screen.getByRole('button', { name: 'Pay ₦54,600' })).toBeTruthy();
  expect(screen.getByText('Includes a service charge of ₦2,600.')).toBeTruthy();
});
