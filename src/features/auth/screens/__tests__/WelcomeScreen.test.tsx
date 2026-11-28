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

it('leaves the terms to the forms, where the agreement happens', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.queryByRole('link', { name: 'Terms' })).toBeNull();
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

it('keeps the headline-to-subline jump at 1.5 (30 and 20)', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.getByRole('header')).toHaveStyle({ fontSize: 30 });
  expect(screen.getByText('Find it, book it, pay in naira.')).toHaveStyle({ fontSize: 20 });
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

it('scrolls when it doesn’t fit, sitting at the bottom when it does', async () => {
  await render(<WelcomeScreen {...props()} notice="accountDeleted" />);
  const scroll = screen.getByTestId('welcome-scroll');
  expect(scroll.props.contentContainerStyle).toMatchObject({
    flexGrow: 1,
    justifyContent: 'flex-end',
  });
  const inside = within(scroll);
  expect(inside.getByText('Your account was deleted.')).toBeTruthy();
  expect(inside.getByRole('link', { name: 'Browse without an account' })).toBeTruthy();
  expect(inside.getByTestId('welcome-fade', { includeHiddenElements: true })).toBeTruthy();
});

it('keeps the browse link 16 pt below the buttons', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.getByTestId('welcome-browse')).toHaveStyle({ marginTop: 16 });
});

it('puts the two choices side by side', async () => {
  await render(<WelcomeScreen {...props()} />);
  expect(screen.getByTestId('welcome-actions')).toHaveStyle({ flexDirection: 'row' });
});

describe('the two actions on a narrow phone (iPhone SE, device check 2026-11-28)', () => {
  const laidOut = (lines: number) => ({
    nativeEvent: { lines: Array.from({ length: lines }, () => ({ text: 'x' })) },
  });
  it('stay side by side while "Create account" fits on one line', async () => {
    await render(<WelcomeScreen {...props()} />);
    await fireEvent(screen.getByText('Create account'), 'textLayout', laidOut(1));
    expect(screen.getByTestId('welcome-actions')).toHaveStyle({ flexDirection: 'row' });
  });
  it('stack, full width, once its label wraps, and stay stacked', async () => {
    await render(<WelcomeScreen {...props()} />);
    await fireEvent(screen.getByText('Create account'), 'textLayout', laidOut(2));
    expect(screen.getByTestId('welcome-actions')).toHaveStyle({ flexDirection: 'column' });
    // Full width it fits again; that must not flip it back.
    await fireEvent(screen.getByText('Create account'), 'textLayout', laidOut(1));
    expect(screen.getByTestId('welcome-actions')).toHaveStyle({ flexDirection: 'column' });
  });
});
