import { Alert, type AlertButton } from 'react-native';

import { runSignOut, syncThenRetry } from '@/features/auth/hooks/useSignOut';

jest.mock('@/features/auth/hooks/useAuth', () => ({ useAuth: jest.fn() }));

it('offline data from a newer app version asks to update first, and can sign out keeping it', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const signOut = jest.fn(() =>
    Promise.resolve({ blocked: { unsynced: 0, unsyncable: 0, appOutdated: true as const } }),
  );
  await runSignOut('u1', signOut);
  expect(alert).toHaveBeenCalledTimes(1);
  const [title, body, buttons] = alert.mock.calls[0] ?? [];
  expect(title).toBe('Update the app before signing out');
  expect(body).toBe(
    'This version can’t read what’s saved on this phone, including admissions that may not have synced. If you sign out now, they stay on this phone. They sync after you update the app, sign in to this account again and open that event’s scanner.',
  );
  const notNow = (buttons ?? []).find((b: AlertButton) => b.text === 'Not now');
  notNow?.onPress?.();
  expect(signOut).toHaveBeenCalledTimes(1);
  const anyway = (buttons ?? []).find((b: AlertButton) => b.text === 'Sign out anyway');
  anyway?.onPress?.();
  expect(signOut).toHaveBeenLastCalledWith({ keepOfflineData: true });
  alert.mockRestore();
});

it('still blocked as outdated after syncing: asks to update, never offers to discard', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  const signOut = jest.fn(() =>
    Promise.resolve({ blocked: { unsynced: 0, unsyncable: 0, appOutdated: true as const } }),
  );
  await syncThenRetry('u1', signOut);
  expect(alert).toHaveBeenCalledTimes(1);
  expect(alert.mock.calls[0]?.[0]).toBe('Update the app before signing out');
  alert.mockRestore();
});
