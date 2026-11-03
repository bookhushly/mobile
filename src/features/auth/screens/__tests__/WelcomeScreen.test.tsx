import { fireEvent, render, screen, within } from '@testing-library/react-native';

import { WelcomeScreen } from '@/features/auth/screens/WelcomeScreen';
import { color } from '@/shared/theme';

// Fresh mocks per test so no assertion can depend on test order.
function props() {
  return {
    notice: null,
    onDismissNotice: jest.fn(),
    onCreateAccount: jest.fn(),
    onSignIn: jest.fn(),
    onBrowse: jest.fn(),
    onOpenLink: jest.fn(),
  };
}

it('offers create account first and sign in second', async () => {
  const onCreateAccount = jest.fn();
  await render(<WelcomeScreen {...props()} onCreateAccount={onCreateAccount} />);
  const buttons = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel));
  expect(buttons.indexOf('Create account')).toBeLessThan(buttons.indexOf('Sign in'));
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(onCreateAccount).toHaveBeenCalled();
});

it('sign in calls onSignIn', async () => {
  const onSignIn = jest.fn();
  await render(<WelcomeScreen {...props()} onSignIn={onSignIn} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(onSignIn).toHaveBeenCalled();
});

it('shows the deleted-account notice once', async () => {
  const onDismissNotice = jest.fn();
  await render(
    <WelcomeScreen {...props()} notice="accountDeleted" onDismissNotice={onDismissNotice} />,
  );
  expect(screen.getByText('Your account was deleted.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'OK' }));
  expect(onDismissNotice).toHaveBeenCalled();
});

it('shows no banner without a notice', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.queryByTestId('banner')).toBeNull();
});

it('terms and privacy open the web pages', async () => {
  const onOpenLink = jest.fn();
  await render(<WelcomeScreen {...props()} onOpenLink={onOpenLink} />);
  await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
  expect(onOpenLink).toHaveBeenCalledWith(expect.stringContaining('bookhushly.com'));
  await fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
  expect(onOpenLink).toHaveBeenLastCalledWith('https://bookhushly.com/privacy');
  expect(onOpenLink).toHaveBeenNthCalledWith(1, 'https://bookhushly.com/terms');
});

it('states all three categories and the naira line', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(
    screen.getByRole('header', { name: 'Events, stays and hotels across Nigeria.' }),
  ).toBeTruthy();
  expect(screen.getByText('Find it, book it, pay in naira.')).toBeTruthy();
  expect(screen.getByLabelText('Bookhushly')).toBeTruthy();
});

it('anchors the fade to the text so large text stays on it', async () => {
  await render(<WelcomeScreen {...props()} />);
  const content = within(screen.getByTestId('welcome-content'));
  expect(content.getByTestId('welcome-fade', { includeHiddenElements: true })).toBeTruthy();
  expect(content.getByRole('header')).toBeTruthy();
});

it('sets the headline at 36 and a stronger subline', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.getByRole('header')).toHaveStyle({ fontSize: 36 });
  expect(screen.getByText('Find it, book it, pay in naira.')).toHaveStyle({ fontSize: 18 });
});

it('underlines the terms links over the photo', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.getByText('Terms')).toHaveStyle({ textDecorationLine: 'underline' });
  expect(screen.getByText('Privacy policy')).toHaveStyle({ textDecorationLine: 'underline' });
});

it('makes Sign in a visibly outlined button', async () => {
  await render(<WelcomeScreen {...props()} />);
  const pressable = screen.getByRole('button', { name: 'Sign in' });
  expect(pressable).toHaveStyle({ borderColor: color.onInverse });
});

it('calls onBrowse from Browse without an account', async () => {
  const onBrowse = jest.fn();
  await render(<WelcomeScreen {...props()} onBrowse={onBrowse} />);
  await fireEvent.press(screen.getByRole('link', { name: 'Browse without an account' }));
  expect(onBrowse).toHaveBeenCalledTimes(1);
});

it('underlines the browse link over the photo', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.getByText('Browse without an account')).toHaveStyle({
    textDecorationLine: 'underline',
    color: color.onInverse,
  });
});
