import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  ModeErrorScreen,
  UpdateRequiredScreen,
  WebOnlyScreen,
} from '@/features/mode/screens/StatusScreens';

it('update required is never a dead end', async () => {
  const { rerender } = await render(
    <UpdateRequiredScreen storeUrl="" platform="android" onOpen={jest.fn()} />,
  );
  expect(screen.getByText(/Play Store/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Update' })).toBeNull();
  const onOpen = jest.fn();
  await rerender(
    <UpdateRequiredScreen
      storeUrl="https://play.google.com/x"
      platform="android"
      onOpen={onOpen}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Update' }));
  expect(onOpen).toHaveBeenCalledWith('https://play.google.com/x');
});

it('update required names the App Store on iOS', async () => {
  await render(<UpdateRequiredScreen storeUrl="" platform="ios" onOpen={jest.fn()} />);
  expect(screen.getByText(/App Store/)).toBeTruthy();
});

it('mode error retries', async () => {
  const onRetry = jest.fn();
  await render(<ModeErrorScreen onRetry={onRetry} onSignOut={jest.fn()} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalled();
});

it('mode error offers sign out', async () => {
  const onSignOut = jest.fn();
  await render(<ModeErrorScreen onRetry={jest.fn()} onSignOut={onSignOut} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalled();
});

it('web-only shows who is signed in', async () => {
  await render(<WebOnlyScreen email="vendor@b.co" onOpenWeb={jest.fn()} onSignOut={jest.fn()} />);
  expect(screen.getByText('vendor@b.co')).toBeTruthy();
});

it('web-only opens the site and signs out', async () => {
  const onOpenWeb = jest.fn();
  const onSignOut = jest.fn();
  await render(<WebOnlyScreen email="vendor@b.co" onOpenWeb={onOpenWeb} onSignOut={onSignOut} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Open bookhushly.com' }));
  expect(onOpenWeb).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign out' }));
  expect(onSignOut).toHaveBeenCalled();
});
