import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import WelcomeRoute from '@/app/(auth)/welcome';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { useBrowseChoice } from '@/features/mode/hooks/useBrowseChoice';
import { useRouteStore } from '@/features/mode/hooks/useRouteStore';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));
jest.mock('@/shared/platform/storage', () => ({
  plainKv: {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  },
}));

beforeEach(() => {
  jest.clearAllMocks();
  useAuthNotice.setState({ notice: null });
  useBrowseChoice.setState({ browsing: false });
  useRouteStore.setState({ route: 'auth' });
});

it('shows the deleted-account notice and drops it when the screen goes away', async () => {
  useAuthNotice.getState().set('accountDeleted');
  await render(<WelcomeRoute />);
  expect(screen.getByText('Your account was deleted.')).toBeTruthy();
  await screen.unmount();
  expect(useAuthNotice.getState().notice).toBeNull();
});

it('Browse stores the choice and waits for the route before leaving', async () => {
  await render(<WelcomeRoute />);
  await fireEvent.press(screen.getByRole('link', { name: 'Browse without an account' }));
  expect(useBrowseChoice.getState().browsing).toBe(true);
  // The customer group isn't in the stack until the root layout has resolved the new route.
  expect(jest.mocked(router.replace)).not.toHaveBeenCalled();
  await act(async () => {
    useRouteStore.getState().setRoute('customer');
    await Promise.resolve();
  });
  expect(jest.mocked(router.replace)).toHaveBeenCalledWith('/explore');
});

it('stays put when the route says customer but this person is not browsing', async () => {
  useRouteStore.setState({ route: 'customer' });
  await render(<WelcomeRoute />);
  expect(jest.mocked(router.replace)).not.toHaveBeenCalled();
});
