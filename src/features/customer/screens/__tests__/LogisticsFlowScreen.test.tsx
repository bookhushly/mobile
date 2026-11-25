import { fireEvent, render, screen } from '@testing-library/react-native';

import { useSubmitRfq } from '@/features/customer/hooks/useCarActions';
import { useLogisticsDraft } from '@/features/customer/hooks/useLogisticsDraft';
import { useProfile } from '@/features/customer/hooks/useProfile';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { LogisticsFlowScreen } from '@/features/customer/screens/LogisticsFlowScreen';

jest.mock('@/features/customer/hooks/useProfile', () => ({ useProfile: jest.fn() }));
jest.mock('@/features/customer/hooks/useCarActions', () => ({ useSubmitRfq: jest.fn() }));
jest.mock('@/features/customer/hooks/useLogistics', () => ({
  useLogisticsPriceGuide: () => ({ min: 45000, max: 70000 }),
}));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-01T10:00:00Z');

let send: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useLogisticsDraft.getState().start();
  useSignInPrompt.getState().dismiss();
  send = jest.fn(() => Promise.resolve({ kind: 'ok', value: { id: 'l-new' } }));
  jest.mocked(useSubmitRfq).mockReturnValue({ send, sending: false });
  jest.mocked(useProfile).mockReturnValue({
    profile: {
      id: 'u1',
      email: 'ada@example.com',
      name: 'Ada Obi',
      phone: '+2348012345678',
      state: null,
      address: null,
    },
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
});

const next = () => screen.getByRole('button', { name: /^(Next|Ask for quotes)$/ });

async function pickState(testID: string, search: string, name: string) {
  await fireEvent.press(screen.getByTestId(testID));
  await fireEvent.changeText(screen.getByLabelText('Search states'), search);
  await fireEvent.press(screen.getByText(name));
}

it('walks seven steps and sends what the web form sends', async () => {
  const onSent = jest.fn();
  await render(
    <LogisticsFlowScreen userId="u1" email="ada@example.com" onClose={jest.fn()} onSent={onSent} />,
  );
  expect(screen.getByRole('progressbar', { name: 'Step 1 of 7' })).toBeTruthy();
  expect(next()).toBeDisabled();
  await fireEvent.press(screen.getByTestId('logistics-service-delivery'));
  await fireEvent.press(next());

  await fireEvent.changeText(
    screen.getByTestId('logistics-pickup-address'),
    '12 Allen Avenue, Ikeja',
  );
  await pickState('logistics-pickup-state', 'lag', 'Lagos');
  await fireEvent.press(next());

  await fireEvent.changeText(
    screen.getByTestId('logistics-dropoff-address'),
    '4 Aminu Kano Crescent',
  );
  await fireEvent.changeText(
    screen.getByTestId('logistics-dropoff-landmark'),
    'Opposite Zenith Bank',
  );
  await pickState('logistics-dropoff-state', 'abuja', 'Abuja (FCT)');
  await fireEvent.press(next());

  await fireEvent.press(screen.getByTestId('day-2026-12-04'));
  await fireEvent.press(screen.getByTestId('day-2026-12-05'));
  await fireEvent.press(next());

  expect(next()).toBeDisabled();
  await fireEvent.changeText(screen.getByTestId('logistics-item'), 'Two boxes of books');
  await fireEvent.press(screen.getByRole('radio', { name: '5–20 kg' }));
  await fireEvent.press(screen.getByTestId('logistics-fragile'));
  await fireEvent.press(next());

  await fireEvent.press(screen.getByTestId('logistics-vehicle-van'));
  await fireEvent.press(next());

  expect(screen.getByText('Check your request')).toBeTruthy();
  expect(screen.getByTestId('check-to')).toHaveTextContent('4 Aminu Kano Crescent, Abuja (FCT)');
  expect(screen.getByText('About ₦45,000–₦70,000')).toBeTruthy();
  await fireEvent.press(next());

  expect(send).toHaveBeenCalledWith({
    service_type: 'delivery',
    full_name: 'Ada Obi',
    email: 'ada@example.com',
    phone: '+2348012345678',
    pickup_address: '12 Allen Avenue, Ikeja',
    pickup_state: 'Lagos',
    pickup_date: '2026-12-04',
    delivery_address: '4 Aminu Kano Crescent',
    delivery_landmark: 'Opposite Zenith Bank',
    delivery_state: 'FCT',
    delivery_date: '2026-12-05',
    item_description: 'Two boxes of books',
    item_weight: '5-20kg',
    quantity: 1,
    vehicle_type: 'van',
    requires_packaging: false,
    requires_insurance: false,
    fragile_items: true,
    perishable_items: false,
  });
  expect(onSent).toHaveBeenCalledWith('l-new');
});

it('asks the item value only when it is to be insured', async () => {
  useLogisticsDraft.getState().start({ serviceType: 'courier' }, 'item');
  await render(
    <LogisticsFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={jest.fn()}
    />,
  );
  expect(screen.queryByTestId('logistics-value')).toBeNull();
  await fireEvent.press(screen.getByTestId('logistics-insure'));
  expect(screen.getByTestId('logistics-value')).toBeTruthy();
});

it('signed out: Ask for quotes asks for sign-in and sends nothing yet', async () => {
  useLogisticsDraft.getState().start(
    {
      serviceType: 'delivery',
      pickup: { address: '12 Allen Avenue', landmark: '', state: 'Lagos' },
      dropoff: { address: '4 Aminu Kano Crescent', landmark: '', state: 'FCT' },
      pickupDate: '2026-12-04',
      itemDescription: 'Books',
    },
    'check',
  );
  await render(<LogisticsFlowScreen userId="" email="" onClose={jest.fn()} onSent={jest.fn()} />);
  await fireEvent.press(next());
  expect(useSignInPrompt.getState().reason).toBe('book');
  expect(send).not.toHaveBeenCalled();
});
