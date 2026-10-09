import { fireEvent, render, screen } from '@testing-library/react-native';

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

it('links to account deletion', async () => {
  const onDeleteAccount = jest.fn();
  await render(
    <AccountSheet
      visible
      email="door@example.com"
      modeSwitcher={null}
      onSignOut={jest.fn()}
      onDeleteAccount={onDeleteAccount}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole('link', { name: 'Delete account' }));
  expect(onDeleteAccount).toHaveBeenCalledTimes(1);
});
