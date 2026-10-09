import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { color } from '@/shared/theme';

const extra = { onForgot: jest.fn(), onCreateAccount: jest.fn(), onConfirmEmail: jest.fn() };

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

it('validates inputs before calling onSubmit', async () => {
  const onSubmit = jest.fn();
  await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('shows the mapped error copy and never blocks retry', async () => {
  const onSubmit = jest.fn().mockResolvedValue('network');
  await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByText(/couldn’t reach the server/i)).toBeTruthy();
  });
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

it('rate limited copy tells the user to wait a minute', async () => {
  const onSubmit = jest.fn().mockResolvedValue('rateLimited');
  await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByText(/try again in a minute/i)).toBeTruthy();
  });
});

it('passes the normalised email to onSubmit', async () => {
  const onSubmit = jest.fn().mockResolvedValue(null);
  await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
  await fill('  A@B.COM ', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith('a@b.com', 'pw');
  });
});

it('announces errors politely so screen readers hear them', async () => {
  const onSubmit = jest.fn().mockResolvedValue('invalidCredentials');
  await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  const msg = await screen.findByText(/email or password is not right/i);
  expect(msg.props.accessibilityLiveRegion).toBe('polite');
});

it('never gets stuck loading if onSubmit throws', async () => {
  const onSubmit = jest.fn().mockRejectedValue(new Error('storage down'));
  await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
  expect(screen.getByText(/couldn’t sign you in/i)).toBeTruthy();
});

it.each(['network', 'rateLimited', 'unavailable'] as const)(
  'a transient %s failure is a neutral banner, never red',
  async (failure) => {
    const onSubmit = jest.fn().mockResolvedValue(failure);
    await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
    await fill('a@b.com', 'pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    const banner = await screen.findByTestId('banner');
    expect(banner).toHaveStyle({ backgroundColor: color.status.neutral.bg });
  },
);

it('wrong credentials are a danger banner', async () => {
  const onSubmit = jest.fn().mockResolvedValue('invalidCredentials');
  await render(<SignInScreen {...extra} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  const banner = await screen.findByTestId('banner');
  expect(banner).toHaveStyle({ backgroundColor: color.status.danger.bg });
});

it('an unconfirmed email starts the confirm flow with the typed email', async () => {
  const onConfirmEmail = jest.fn().mockResolvedValue(undefined);
  await render(
    <SignInScreen
      onSubmit={jest.fn().mockResolvedValue('emailNotConfirmed')}
      onForgot={jest.fn()}
      onCreateAccount={jest.fn()}
      onConfirmEmail={onConfirmEmail}
    />,
  );
  await fill('Ada@B.co', 'Abcdefg1!');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(onConfirmEmail).toHaveBeenCalledWith('ada@b.co');
  });
});

it('a failed confirm handoff never leaves the button stuck loading', async () => {
  const onConfirmEmail = jest.fn().mockRejectedValue(new Error('down'));
  await render(
    <SignInScreen
      onSubmit={jest.fn().mockResolvedValue('emailNotConfirmed')}
      onForgot={jest.fn()}
      onCreateAccount={jest.fn()}
      onConfirmEmail={onConfirmEmail}
    />,
  );
  await fill('a@b.co', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
  expect(screen.getByText(/Confirm your email first/)).toBeTruthy();
});

it('forgot password carries the typed email', async () => {
  const onForgot = jest.fn();
  await render(
    <SignInScreen
      onSubmit={jest.fn()}
      onForgot={onForgot}
      onCreateAccount={jest.fn()}
      onConfirmEmail={jest.fn()}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ada@b.co');
  await fireEvent.press(screen.getByRole('link', { name: 'Forgot password?' }));
  expect(onForgot).toHaveBeenCalledWith('ada@b.co');
});

it('the create-account link hands off', async () => {
  const onCreateAccount = jest.fn();
  await render(<SignInScreen {...extra} onSubmit={jest.fn()} onCreateAccount={onCreateAccount} />);
  await fireEvent.press(screen.getByRole('link', { name: 'New here? Create account' }));
  expect(onCreateAccount).toHaveBeenCalled();
  expect(screen.queryByText(/bookhushly\.com/)).toBeNull();
});

it('a closed account is shown as a refusal (danger), not a network problem', async () => {
  await render(
    <SignInScreen
      onSubmit={jest.fn().mockResolvedValue('accountClosed')}
      onForgot={jest.fn()}
      onCreateAccount={jest.fn()}
      onConfirmEmail={jest.fn()}
    />,
  );
  await fill('a@b.co', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(/This account was closed/)).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.danger.bg });
});
