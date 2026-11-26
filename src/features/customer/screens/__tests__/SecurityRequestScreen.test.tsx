import { fireEvent, render, screen } from '@testing-library/react-native';

import type { SecurityRequest } from '@/features/customer/schemas/security';
import { SecurityRequestScreen } from '@/features/customer/screens/SecurityRequestScreen';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
const mockOne = jest.fn();
const mockActions = jest.fn();
jest.mock('@/features/customer/hooks/useCarRequests', () => ({
  useRfqRequest: (): unknown => mockOne(),
}));
jest.mock('@/features/customer/hooks/useCarActions', () => ({
  useRfqActions: (): unknown => mockActions(),
  useRfqReview: () => ({ state: { kind: 'idle' }, post: jest.fn(), reset: jest.fn() }),
}));
jest.mock('@/features/customer/hooks/useCarPayment', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/features/customer/hooks/useCarPayment'),
  useRfqPayment: () => ({
    state: { kind: 'idle' },
    pay: jest.fn(),
    checkAgain: jest.fn(),
    paymentOpen: jest.fn(() => Promise.resolve('clear')),
  }),
}));
jest.mock('@/features/customer/offline/carPayStore', () => ({ carPayStore: {} }));
jest.mock('@/features/customer/hooks/useCheckoutData', () => ({
  useServiceCharge: () => ({ data: null }),
}));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-06T10:00:00Z');

const request = (over: Partial<SecurityRequest>): SecurityRequest => ({
  id: 's1',
  status: 'in_progress',
  service: 'residential',
  address: '7 Bourdillon Road',
  landmark: null,
  pickupDate: '2026-12-05',
  pickupState: 'Lagos',
  endDate: null,
  startTime: '18:00',
  duration: 'monthly',
  guards: 2,
  guardType: 'unarmed',
  shift: 'night',
  canine: false,
  vehicle: false,
  notes: null,
  details: {
    eventType: '',
    attendance: '',
    eventHours: '',
    vip: false,
    propertyType: null,
    propertySize: null,
    entrances: '',
    cctv: false,
    alarm: false,
    risk: null,
    incidents: false,
    incidentDetails: '',
    backgroundCheck: true,
    uniform: true,
    radios: true,
  },
  expiresAt: null,
  createdAt: '2026-12-01T10:00:00Z',
  vendorCompletedAt: null,
  offerCount: 0,
  selectedVendor: { id: 'v1', name: 'Shield Guards', phone: '+2348033333333' },
  selectedOffer: null,
  offers: [],
  ...over,
});

let actions: { busy: null; cancel: jest.Mock; confirmDone: jest.Mock; select: jest.Mock };

function show(r: SecurityRequest) {
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
});

const screenFor = () => (
  <SecurityRequestScreen
    userId="u1"
    id="s1"
    onBack={jest.fn()}
    onSeeQuotes={jest.fn()}
    onAskAgain={jest.fn()}
  />
);

it('on duty: what’s booked, Call, and confirm waits for the company', async () => {
  show(request({}));
  await render(screenFor());
  expect(screen.getByText('Your guards are on duty')).toBeTruthy();
  expect(screen.getByText('2 unarmed guards · months')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Call Shield Guards' })).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Confirm the job’s done' })).toBeDisabled();
});

it('the company marked it done: the customer can confirm', async () => {
  show(request({ vendorCompletedAt: '2026-12-06T09:00:00Z' }));
  await render(screenFor());
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm the job’s done' }));
  expect(actions.confirmDone).toHaveBeenCalled();
});

it('waiting: sent to security companies in the state; cancelling needs a reason', async () => {
  show(
    request({
      status: 'open',
      selectedVendor: null,
      expiresAt: '2026-12-08T13:00:00Z',
    }),
  );
  await render(screenFor());
  expect(screen.getByText(/Sent to security companies in Lagos/)).toBeTruthy();
  await fireEvent.press(screen.getByTestId('car-cancel'));
  expect(screen.getByTestId('car-cancel-confirm')).toBeDisabled();
});
