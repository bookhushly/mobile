import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { BackHandler } from 'react-native';

import NewPasswordRoute from '@/app/(auth)/new-password';
import { useAuth } from '@/features/auth/hooks/useAuth';

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));
jest.mock('@/features/auth/api/accountApi', () => ({
  resetPassword: jest.fn(() => Promise.resolve({ ok: true, value: true })),
}));
jest.mock('@/shared/api/instance', () => ({ api: {} }));
jest.mock('@/shared/platform/secureStore', () => ({
  secureKv: {
    get: () => Promise.resolve(null),
    set: () => Promise.resolve(),
    delete: () => Promise.resolve(),
  },
}));
jest.mock('@/shared/supabase/client', () => ({
  STORAGE_KEY: 'bh-auth',
  sessionStore: { removeItem: () => Promise.resolve() },
  supabase: { auth: { signOut: () => Promise.resolve({ error: null }) } },
}));

const abandonRecovery = jest.fn<Promise<void>, []>();
const finishRecovery = jest.fn<Promise<void>, []>();
const replace = jest.mocked(router.replace);

beforeEach(() => {
  jest.clearAllMocks();
  abandonRecovery.mockResolvedValue(undefined);
  finishRecovery.mockResolvedValue(undefined);
  useAuth.setState({
    state: { status: 'signedIn', userId: 'u1', email: 'a@b.co' },
    recovery: true,
    abandonRecovery,
    finishRecovery,
  });
});

it('Cancel abandons the reset, then leaves for Welcome', async () => {
  await render(<NewPasswordRoute />);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => {
    expect(replace).toHaveBeenCalledWith('/welcome');
  });
  expect(abandonRecovery).toHaveBeenCalledTimes(1);
  // The sign-out finished before the route left.
  expect(abandonRecovery.mock.invocationCallOrder[0]).toBeLessThan(
    replace.mock.invocationCallOrder[0] ?? 0,
  );
  expect(finishRecovery).not.toHaveBeenCalled();
});

it('Android back abandons the reset once, then leaves for Welcome', async () => {
  const back: { handler?: () => boolean } = {};
  jest.spyOn(BackHandler, 'addEventListener').mockImplementation((_e, handler) => {
    back.handler = handler as () => boolean;
    return { remove: jest.fn() };
  });
  await render(<NewPasswordRoute />);
  expect(back.handler?.()).toBe(true);
  expect(back.handler?.()).toBe(true);
  await waitFor(() => {
    expect(replace).toHaveBeenCalledWith('/welcome');
  });
  expect(abandonRecovery).toHaveBeenCalledTimes(1);
  expect(replace).toHaveBeenCalledTimes(1);
});

it('a successful save finishes the reset and never abandons it', async () => {
  await render(<NewPasswordRoute />);
  await fireEvent.changeText(screen.getByLabelText('New password'), 'Abcdefg1!');
  await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
  await waitFor(() => {
    expect(finishRecovery).toHaveBeenCalledTimes(1);
  });
  await screen.unmount();
  expect(abandonRecovery).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it('unmounting mid-reset abandons it', async () => {
  await render(<NewPasswordRoute />);
  await screen.unmount();
  expect(abandonRecovery).toHaveBeenCalledTimes(1);
});

it('unmounting after the reset ended does nothing', async () => {
  await render(<NewPasswordRoute />);
  useAuth.setState({ recovery: false });
  await screen.unmount();
  expect(abandonRecovery).not.toHaveBeenCalled();
});
