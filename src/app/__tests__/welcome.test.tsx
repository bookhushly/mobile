import { render, screen } from '@testing-library/react-native';

import WelcomeRoute from '@/app/(auth)/welcome';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));

beforeEach(() => {
  useAuthNotice.setState({ notice: null });
});

it('shows the deleted-account notice and drops it when the screen goes away', async () => {
  useAuthNotice.getState().set('accountDeleted');
  await render(<WelcomeRoute />);
  expect(screen.getByText('Your account was deleted.')).toBeTruthy();
  await screen.unmount();
  expect(useAuthNotice.getState().notice).toBeNull();
});
