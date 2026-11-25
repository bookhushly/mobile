import { fireEvent, render, screen } from '@testing-library/react-native';

import { useSubmitRfq } from '@/features/customer/hooks/useCarActions';
import { useProfile } from '@/features/customer/hooks/useProfile';
import { useSecurityDraft } from '@/features/customer/hooks/useSecurity';
import { useSignInPrompt } from '@/features/customer/hooks/useSignInPrompt';
import { SecurityFlowScreen } from '@/features/customer/screens/SecurityFlowScreen';

jest.mock('@/features/customer/hooks/useProfile', () => ({ useProfile: jest.fn() }));
jest.mock('@/features/customer/hooks/useCarActions', () => ({ useSubmitRfq: jest.fn() }));
jest.mock('@/features/customer/hooks/useSecurity', () => ({
  ...jest.requireActual<Record<string, unknown>>('@/features/customer/hooks/useSecurity'),
  useSecurityPriceGuide: () => ({ min: 150000, max: 220000 }),
}));
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-01T10:00:00Z');

let send: jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
  useSecurityDraft.getState().start();
  useSignInPrompt.getState().dismiss();
  send = jest.fn(() => Promise.resolve({ kind: 'ok', value: { id: 's-new' } }));
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

it('walks seven steps and sends what the web form sends', async () => {
  const onSent = jest.fn();
  await render(
    <SecurityFlowScreen userId="u1" email="ada@example.com" onClose={jest.fn()} onSent={onSent} />,
  );
  expect(screen.getByRole('progressbar', { name: 'Step 1 of 7' })).toBeTruthy();
  await fireEvent.press(screen.getByTestId('security-service-residential'));
  await fireEvent.press(next());

  await fireEvent.changeText(screen.getByTestId('security-address'), '7 Bourdillon Road, Ikoyi');
  await fireEvent.press(screen.getByTestId('security-state'));
  await fireEvent.changeText(screen.getByLabelText('Search states'), 'lag');
  await fireEvent.press(screen.getByText('Lagos'));
  await fireEvent.press(next());

  await fireEvent.press(screen.getByTestId('day-2026-12-05'));
  await fireEvent.press(screen.getByRole('radio', { name: '6:00 pm' }));
  await fireEvent.press(next());

  expect(next()).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'Months' }));
  await fireEvent.press(screen.getByRole('radio', { name: 'Unarmed' }));
  // A required answer can't be cleared by tapping it again.
  await fireEvent.press(screen.getByRole('radio', { name: 'Unarmed' }));
  expect(next()).toBeEnabled();
  await fireEvent.press(next());

  // What they bring: common needs start on, as on the web.
  expect(screen.getByRole('checkbox', { name: 'In uniform', checked: true })).toBeTruthy();
  await fireEvent.press(screen.getByTestId('security-dog'));
  await fireEvent.press(next());

  // Property questions only for a home or business; skipping the step is fine.
  expect(screen.getByTestId('security-entrances')).toBeTruthy();
  expect(screen.queryByTestId('security-event-type')).toBeNull();
  await fireEvent.press(next());

  expect(screen.getByText('Check your request')).toBeTruthy();
  expect(screen.getByTestId('check-team')).toHaveTextContent('1 unarmed guard · months');
  expect(screen.getByText('₦150,000–₦220,000 per guard a month')).toBeTruthy();
  await fireEvent.press(next());

  expect(send).toHaveBeenCalledWith(
    expect.objectContaining({
      service_type: 'residential',
      service_address: '7 Bourdillon Road, Ikoyi',
      state: 'Lagos',
      start_date: '2026-12-05',
      start_time: '18:00',
      duration_type: 'monthly',
      number_of_guards: 1,
      guard_type: 'unarmed',
      requires_canine: true,
      requires_uniform: true,
      full_name: 'Ada Obi',
      phone: '+2348012345678',
    }),
  );
  expect(onSent).toHaveBeenCalledWith('s-new');
});

it('asks event questions for an event, not property ones', async () => {
  useSecurityDraft.getState().start({ service: 'event_security' }, 'details');
  await render(
    <SecurityFlowScreen
      userId="u1"
      email="ada@example.com"
      onClose={jest.fn()}
      onSent={jest.fn()}
    />,
  );
  expect(screen.getByTestId('security-event-type')).toBeTruthy();
  expect(screen.queryByTestId('security-entrances')).toBeNull();
});
