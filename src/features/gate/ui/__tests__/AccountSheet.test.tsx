import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { AccountSheet } from '@/features/gate/ui/AccountSheet';
import { Text } from '@/shared/ui';

it('shows who is signed in, the mode switch slot, and signs out', async () => {
  const onSignOut = jest.fn();
  await render(
    <AccountSheet
      visible
      email="door@example.com"
      modeSwitcher={<Text>Mode switch</Text>}
      onSignOut={onSignOut}
      onDeleteAccount={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  expect(screen.getByText('door@example.com')).toBeTruthy();
  expect(screen.getByText('Mode switch')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledTimes(1);
});

afterEach(() => {
  jest.restoreAllMocks();
});

it('on iPhone, Delete account closes the sheet and opens deletion only once it has gone', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const onDeleteAccount = jest.fn();
  const onClose = jest.fn();
  await render(
    <AccountSheet
      visible
      email="door@example.com"
      modeSwitcher={null}
      onSignOut={jest.fn()}
      onDeleteAccount={onDeleteAccount}
      onClose={onClose}
    />,
  );
  await fireEvent.press(screen.getByRole('link', { name: 'Delete account' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onDeleteAccount).not.toHaveBeenCalled();
  // The RN Modal reports the end of its dismiss animation on iOS.
  await fireEvent(screen.getByTestId('account-sheet'), 'dismiss');
  expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId('account-sheet'), 'dismiss');
  expect(onDeleteAccount).toHaveBeenCalledTimes(1);
});

it('on Android, Delete account closes the sheet and opens deletion at once', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const onDeleteAccount = jest.fn();
  const onClose = jest.fn();
  await render(
    <AccountSheet
      visible
      email="door@example.com"
      modeSwitcher={null}
      onSignOut={jest.fn()}
      onDeleteAccount={onDeleteAccount}
      onClose={onClose}
    />,
  );
  await fireEvent.press(screen.getByRole('link', { name: 'Delete account' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onDeleteAccount).toHaveBeenCalledTimes(1);
  expect(onClose.mock.invocationCallOrder[0]).toBeLessThan(
    onDeleteAccount.mock.invocationCallOrder[0] ?? 0,
  );
});
