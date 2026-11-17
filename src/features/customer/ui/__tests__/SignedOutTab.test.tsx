import { fireEvent, render, screen } from '@testing-library/react-native';

import { SignedOutTab } from '../SignedOutTab';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve()),
}));

const noop = () => undefined;

it('bookings copy mentions adding website bookings', async () => {
  await render(<SignedOutTab tab="bookings" onSignIn={noop} onCreateAccount={noop} />);
  expect(screen.getByText('Your bookings live here')).toBeTruthy();
  expect(
    screen.getByText(
      'Booked on the website? Sign in with the same email and we’ll help you add them.',
    ),
  ).toBeTruthy();
});

it('saved and account show their own heading', async () => {
  await render(<SignedOutTab tab="saved" onSignIn={noop} onCreateAccount={noop} />);
  expect(screen.getByText('Your saved places live here')).toBeTruthy();
});

it('account shows its heading, help and legal links, and no delete or sign out', async () => {
  await render(<SignedOutTab tab="account" onSignIn={noop} onCreateAccount={noop} />);
  expect(screen.getByText('Your account lives here')).toBeTruthy();
  expect(screen.getByText('Help')).toBeTruthy();
  expect(screen.getByText('Terms')).toBeTruthy();
  expect(screen.getByText('Privacy')).toBeTruthy();
  expect(screen.queryByText('Delete account')).toBeNull();
  expect(screen.queryByText('Sign out')).toBeNull();
});

it('saved and bookings show no help links', async () => {
  await render(<SignedOutTab tab="saved" onSignIn={noop} onCreateAccount={noop} />);
  expect(screen.queryByText('Terms')).toBeNull();
});

it('Sign in and Create account call their handlers', async () => {
  const onSignIn = jest.fn();
  const onCreateAccount = jest.fn();
  await render(
    <SignedOutTab tab="bookings" onSignIn={onSignIn} onCreateAccount={onCreateAccount} />,
  );
  await fireEvent.press(screen.getByText('Sign in'));
  await fireEvent.press(screen.getByText('Create account'));
  expect(onSignIn).toHaveBeenCalledTimes(1);
  expect(onCreateAccount).toHaveBeenCalledTimes(1);
});

it('opens with the tab’s page title as the header, as Explore does', async () => {
  await render(<SignedOutTab tab="saved" onSignIn={noop} onCreateAccount={noop} />);
  expect(screen.getByRole('header', { name: 'Saved' })).toBeTruthy();
  expect(screen.getByText('Your saved places live here')).toBeTruthy();
});

it('keeps 12 pt between the buttons', async () => {
  await render(<SignedOutTab tab="saved" onSignIn={noop} onCreateAccount={noop} />);
  expect(screen.getByTestId('signed-out-actions')).toHaveStyle({ gap: 12 });
});
