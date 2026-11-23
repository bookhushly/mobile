import { act, fireEvent, render, screen } from '@testing-library/react-native';

import { useSubmitCarRequest } from '@/features/customer/hooks/useCarActions';
import { useCarDraft } from '@/features/customer/hooks/useCarDraft';
import { useProfile } from '@/features/customer/hooks/useProfile';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { CarRequestFlowScreen } from '@/features/customer/screens/CarRequestFlowScreen';

jest.mock('@/features/customer/hooks/useProfile', () => ({ useProfile: jest.fn() }));
jest.mock('@/features/customer/hooks/useCarActions', () => ({ useSubmitCarRequest: jest.fn() }));
jest.mock('@/features/customer/hooks/useCarRequests', () => ({
  useCarPriceGuide: () => ({ min: 35000, max: 55000 }),
}));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-01T10:00:00Z');

const mockProfile = jest.mocked(useProfile);
const mockSubmit = jest.mocked(useSubmitCarRequest);

let send: jest.Mock;

function profile(phone: string | null) {
  mockProfile.mockReturnValue({
    profile: {
      id: 'u1',
      email: 'ada@example.com',
      name: 'Ada Obi',
      phone,
      state: null,
      address: null,
    },
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  useCarDraft.getState().start();
  useSignInPrompt.getState().dismiss();
  send = jest.fn(() => Promise.resolve({ kind: 'ok', value: { id: 'new-id' } }));
  mockSubmit.mockReturnValue({ send, sending: false });
  profile('+2348012345678');
});

const next = () => screen.getByRole('button', { name: /^(Next|Ask for quotes)/ });

async function fillToCheck() {
  await fireEvent.changeText(screen.getByTestId('car-pickup-address'), 'Allen Avenue, Ikeja');
  await fireEvent.press(screen.getByTestId('car-pickup-state'));
  await fireEvent.changeText(screen.getByLabelText('Search states'), 'lag');
  await fireEvent.press(screen.getByText('Lagos'));
  await fireEvent.press(next());
  // When: Fri 4 → Sun 6 Dec is three days, and the button says so.
  await fireEvent.press(screen.getByTestId('day-2026-12-04'));
  await fireEvent.press(screen.getByTestId('day-2026-12-06'));
  expect(screen.getByRole('button', { name: 'Next · 3 days' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('radio', { name: '9:00 am' }));
  await fireEvent.press(next());
  await fireEvent.press(screen.getByTestId('car-trip-chauffeur'));
  await fireEvent.press(next());
  await fireEvent.press(screen.getByTestId('car-type-sedan'));
  await fireEvent.press(next());
  await fireEvent.press(screen.getByRole('radio', { name: 'Full day' }));
  await fireEvent.press(next());
}

it('walks six steps, holding Next until each is answered, then sends the request', async () => {
  const onSent = jest.fn();
  await render(
    <CarRequestFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={onSent}
    />,
  );
  expect(screen.getByRole('progressbar', { name: 'Step 1 of 6' })).toBeTruthy();
  expect(next()).toBeDisabled();
  await fillToCheck();

  expect(screen.getByText('Check your request')).toBeTruthy();
  expect(screen.getByTestId('check-where')).toHaveTextContent('Allen Avenue, Ikeja, Lagos');
  expect(screen.getByTestId('check-when')).toHaveTextContent(
    'Fri 4 → Sun 6 Dec · 9:00 am · 3 days',
  );
  expect(screen.getByText('About ₦35,000–₦55,000 a day')).toBeTruthy();

  await fireEvent.press(next());
  expect(send).toHaveBeenCalledWith({
    trip_type: 'chauffeur',
    pickup_state: 'Lagos',
    pickup_address: 'Allen Avenue, Ikeja',
    pickup_date: '2026-12-04',
    pickup_time: '09:00',
    return_date: '2026-12-06',
    number_of_passengers: 1,
    vehicle_type: 'sedan',
    pricing_model: 'full_day',
    is_urgent: false,
    full_name: 'Ada Obi',
    email: 'ada@example.com',
    phone: '+2348012345678',
  });
  expect(onSent).toHaveBeenCalledWith('new-id');
  // Sent: the next request starts fresh.
  expect(useCarDraft.getState().draft.pickupState).toBeNull();
});

it('Edit on the check step returns to it after one answer', async () => {
  await render(
    <CarRequestFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={jest.fn()}
    />,
  );
  await fillToCheck();
  await fireEvent.press(screen.getByRole('button', { name: 'Edit car' }));
  expect(screen.getByText('What kind of car?')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('car-type-any'));
  await fireEvent.press(next());
  expect(screen.getByTestId('check-car')).toHaveTextContent('Any car');
});

it('asks for a phone number when the account has none', async () => {
  profile(null);
  await render(
    <CarRequestFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={jest.fn()}
    />,
  );
  await fillToCheck();
  await fireEvent.press(next());
  expect(send).not.toHaveBeenCalled();
  expect(screen.getByText('Enter a Nigerian mobile number')).toBeTruthy();
  await fireEvent.changeText(screen.getByTestId('car-phone'), '0801 234 5678');
  await fireEvent.press(next());
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ phone: '+2348012345678' }));
});

it('a connection failure keeps the answers and says try again, never a refusal', async () => {
  send.mockResolvedValueOnce({ kind: 'tryAgain' });
  await render(
    <CarRequestFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={jest.fn()}
    />,
  );
  await fillToCheck();
  await fireEvent.press(next());
  expect(
    screen.getByText(/Check your connection and try again. Your answers are kept./),
  ).toBeTruthy();
  expect(useCarDraft.getState().draft.pickupState).toBe('Lagos');
});

it('signed out: every step works, and Ask for quotes signs in first, then sends', async () => {
  const onSent = jest.fn();
  const view = await render(
    <CarRequestFlowScreen userId="" email="" onClose={jest.fn()} onSent={onSent} />,
  );
  await fillToCheck();
  await fireEvent.press(next());
  expect(useSignInPrompt.getState().reason).toBe('book');
  expect(send).not.toHaveBeenCalled();

  await act(() => {
    useSignInPrompt.getState().proceed();
  });
  await view.rerender(
    <CarRequestFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={onSent}
    />,
  );
  expect(send).toHaveBeenCalledTimes(1);
  expect(onSent).toHaveBeenCalledWith('new-id');
});

it('a send left waiting from an earlier visit never fires on its own', async () => {
  await render(<CarRequestFlowScreen userId="" email="" onClose={jest.fn()} onSent={jest.fn()} />);
  await fillToCheck();
  await fireEvent.press(next());
  expect(useCarDraft.getState().sendAfterSignIn).toBe(true);
  // "Not now", the flow closed; later, signed in, the flow opens again on the check step.
  await act(() => {
    useSignInPrompt.getState().dismiss();
  });
  await screen.unmount();
  await render(
    <CarRequestFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={jest.fn()}
    />,
  );
  expect(screen.getByText('Check your request')).toBeTruthy();
  expect(send).not.toHaveBeenCalled();
});
