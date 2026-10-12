import { fireEvent, render, screen } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { DeskAccountSheet } from '@/features/receptionist/ui/DeskAccountSheet';
import { Text } from '@/shared/ui';

afterEach(() => {
  jest.restoreAllMocks();
});

const base = {
  visible: true,
  email: 'desk@example.com',
  hotelName: 'Eko Suites',
  modeSwitcher: <Text>Mode switch</Text>,
  onChangeHotel: jest.fn(),
  onActivity: jest.fn(),
  onSignOut: jest.fn(),
  onClose: jest.fn(),
};

it('shows who is signed in, where, the mode switch slot, and signs out', async () => {
  const onSignOut = jest.fn();
  await render(<DeskAccountSheet {...base} canChangeHotel={false} onSignOut={onSignOut} />);
  expect(screen.getByText('desk@example.com')).toBeTruthy();
  expect(screen.getByText('Eko Suites')).toBeTruthy();
  expect(screen.getByText('Mode switch')).toBeTruthy();
  expect(screen.queryByText(/delete account/i)).toBeNull();
  expect(screen.queryByRole('link', { name: 'Change hotel' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalledTimes(1);
});

it('offers Change hotel only when there is more than one hotel', async () => {
  const onChangeHotel = jest.fn();
  const onClose = jest.fn();
  await render(
    <DeskAccountSheet {...base} canChangeHotel onChangeHotel={onChangeHotel} onClose={onClose} />,
  );
  await fireEvent.press(screen.getByRole('link', { name: 'Change hotel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onChangeHotel).toHaveBeenCalledTimes(1);
});

it('on iPhone, Shift activity closes the sheet and navigates once it has gone', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  const onActivity = jest.fn();
  const onClose = jest.fn();
  await render(
    <DeskAccountSheet {...base} canChangeHotel={false} onActivity={onActivity} onClose={onClose} />,
  );
  await fireEvent.press(screen.getByRole('link', { name: 'Shift activity' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onActivity).not.toHaveBeenCalled();
  await fireEvent(screen.getByTestId('desk-account-sheet'), 'dismiss');
  expect(onActivity).toHaveBeenCalledTimes(1);
  await fireEvent(screen.getByTestId('desk-account-sheet'), 'dismiss');
  expect(onActivity).toHaveBeenCalledTimes(1);
});

it('on Android, Shift activity closes the sheet and navigates at once', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  const onActivity = jest.fn();
  const onClose = jest.fn();
  await render(
    <DeskAccountSheet {...base} canChangeHotel={false} onActivity={onActivity} onClose={onClose} />,
  );
  await fireEvent.press(screen.getByRole('link', { name: 'Shift activity' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onActivity).toHaveBeenCalledTimes(1);
});
