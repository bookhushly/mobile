import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import DeleteAccountRoute from '@/app/delete-account';
import { useAuth } from '@/features/auth/hooks/useAuth';

const mockCheckSignOut = jest.fn<Promise<{ unsynced: number; unsyncable: number }>, [string]>();
const mockRefreshSession = jest.fn<Promise<{ error: unknown }>, []>();

jest.mock('expo-router', () => ({
  router: { replace: jest.fn(), push: jest.fn(), back: jest.fn() },
}));
jest.mock('@/features/auth/api/accountApi', () => ({
  deleteAccount: jest.fn(() => Promise.resolve({ ok: true, value: true })),
}));
jest.mock('@/shared/api/instance', () => ({ api: {} }));
jest.mock('@/shared/lib/signOutGuard', () => ({
  checkSignOut: (id: string) => mockCheckSignOut(id),
}));
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
  supabase: {
    auth: {
      signOut: () => Promise.resolve({ error: null }),
      refreshSession: () => mockRefreshSession(),
    },
  },
}));

const signedIn = { status: 'signedIn', userId: 'u1', email: 'ada@b.co' } as const;
const checkPassword = jest.fn<Promise<'ok' | 'wrong' | 'transient' | 'closed'>, [string]>();
const signOutAfterDeletion = jest.fn<Promise<void>, [string]>();
const replace = jest.mocked(router.replace);

beforeEach(() => {
  jest.clearAllMocks();
  mockCheckSignOut.mockResolvedValue({ unsynced: 0, unsyncable: 0 });
  checkPassword.mockResolvedValue('ok');
  signOutAfterDeletion.mockResolvedValue(undefined);
  useAuth.setState({ state: signedIn, recovery: false, checkPassword, signOutAfterDeletion });
});

async function fillAndDelete() {
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Abcdefg1!');
  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
  await fireEvent.press(screen.getByRole('button', { name: 'Delete account' }));
}

it('wipes by the captured user id, even when the session is already gone, then leaves', async () => {
  await render(<DeleteAccountRoute />);
  expect(screen.getByText('ada@b.co')).toBeTruthy();
  // A banned refresh can emit SIGNED_OUT before the delete resolves: the id must survive it.
  signOutAfterDeletion.mockImplementation((id) => {
    expect(id).toBe('u1');
    useAuth.setState({ state: { status: 'signedOut' } });
    return Promise.resolve();
  });
  await fillAndDelete();
  await waitFor(() => {
    expect(signOutAfterDeletion).toHaveBeenCalledWith('u1');
  });
  await waitFor(() => {
    expect(replace).toHaveBeenCalledWith('/');
  });
  expect(checkPassword).toHaveBeenCalledWith('Abcdefg1!');
});

it('leaves as soon as the session is gone', async () => {
  await render(<DeleteAccountRoute />);
  expect(replace).not.toHaveBeenCalled();
  await act(() => {
    useAuth.setState({ state: { status: 'signedOut' } });
  });
  await waitFor(() => {
    expect(replace).toHaveBeenCalledWith('/');
  });
});

it('shows no unsynced warning until the count is known, then warns', async () => {
  let answer: (c: { unsynced: number; unsyncable: number }) => void = () => undefined;
  mockCheckSignOut.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  await render(<DeleteAccountRoute />);
  expect(screen.queryByTestId('unsynced-banner')).toBeNull();
  await act(() => {
    answer({ unsynced: 2, unsyncable: 0 });
  });
  expect(await screen.findByText(/2 admissions haven’t synced/)).toBeTruthy();
});

it('says "some" when the count cannot be read', async () => {
  mockCheckSignOut.mockRejectedValue(new Error('db'));
  await render(<DeleteAccountRoute />);
  expect(await screen.findByText('Some admissions may not have synced.')).toBeTruthy();
});

it('a banned refresh after an uncertain delete counts as deleted', async () => {
  const { deleteAccount } = jest.requireMock<{ deleteAccount: jest.Mock }>(
    '@/features/auth/api/accountApi',
  );
  deleteAccount.mockResolvedValueOnce({ ok: false, error: { kind: 'unauthorized' } });
  mockRefreshSession.mockResolvedValue({ error: { code: 'user_banned', message: 'banned' } });
  await render(<DeleteAccountRoute />);
  await fillAndDelete();
  await waitFor(() => {
    expect(signOutAfterDeletion).toHaveBeenCalledWith('u1');
  });
});

it('cancel goes back', async () => {
  await render(<DeleteAccountRoute />);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(router.back).toHaveBeenCalledTimes(1);
});
