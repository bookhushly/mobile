import { fireEvent, render, screen } from '@testing-library/react-native';

import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';

const base = {
  notice: null,
  onDismissNotice: jest.fn(),
  onCreateAccount: jest.fn(),
  onSignIn: jest.fn(),
  onOpenLink: jest.fn(),
};

it('offers create account first and sign in second', async () => {
  await render(<WelcomeScreen {...base} />);
  const buttons = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel));
  expect(buttons.indexOf('Create account')).toBeLessThan(buttons.indexOf('Sign in'));
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(base.onCreateAccount).toHaveBeenCalled();
});

it('sign in calls onSignIn', async () => {
  const onSignIn = jest.fn();
  await render(<WelcomeScreen {...base} onSignIn={onSignIn} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(onSignIn).toHaveBeenCalled();
});

it('shows the deleted-account notice once', async () => {
  const onDismissNotice = jest.fn();
  await render(
    <WelcomeScreen {...base} notice="accountDeleted" onDismissNotice={onDismissNotice} />,
  );
  expect(screen.getByText('Your account was deleted.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
  expect(onDismissNotice).toHaveBeenCalled();
});

it('shows no banner without a notice', async () => {
  await render(<WelcomeScreen {...base} />);
  expect(screen.queryByTestId('banner')).toBeNull();
});

it('terms and privacy open the web pages', async () => {
  const onOpenLink = jest.fn();
  await render(<WelcomeScreen {...base} onOpenLink={onOpenLink} />);
  await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
  expect(onOpenLink).toHaveBeenCalledWith(expect.stringContaining('bookhushly.com'));
  await fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
  expect(onOpenLink).toHaveBeenLastCalledWith('https://bookhushly.com/privacy');
  expect(onOpenLink).toHaveBeenNthCalledWith(1, 'https://bookhushly.com/terms');
});

it('shows the headline and the welcome illustration', async () => {
  await render(<WelcomeScreen {...base} />);
  expect(screen.getByText('Book stays and events across Nigeria')).toBeTruthy();
  // Decorative: hidden from screen readers, so the query has to include hidden elements.
  expect(screen.getByTestId('illustration-welcome', { includeHiddenElements: true })).toBeTruthy();
});
