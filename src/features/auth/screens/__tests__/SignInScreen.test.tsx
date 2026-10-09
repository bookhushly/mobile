import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SignInScreen } from '@/features/auth/screens/SignInScreen';
import { color } from '@/shared/theme';

// Fresh mocks per test so no assertion can depend on test order.
function props() {
  return {
    onSubmit: jest.fn(),
    onForgot: jest.fn(),
    onCreateAccount: jest.fn(),
    onConfirmEmail: jest.fn(),
  };
}

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

it('validates inputs before calling onSubmit', async () => {
  const onSubmit = jest.fn();
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('shows the mapped error copy and never blocks retry', async () => {
  const onSubmit = jest.fn().mockResolvedValue('network');
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByText(/couldn’t reach Bookhushly — try again in a minute/i)).toBeTruthy();
  });
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

it('rate limited copy tells the user to wait a minute', async () => {
  const onSubmit = jest.fn().mockResolvedValue('rateLimited');
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByText(/try again in a minute/i)).toBeTruthy();
  });
});

it('passes the normalised email to onSubmit', async () => {
  const onSubmit = jest.fn().mockResolvedValue(null);
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fill('  A@B.COM ', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith('a@b.com', 'pw');
  });
});

it('announces errors politely so screen readers hear them', async () => {
  const onSubmit = jest.fn().mockResolvedValue('invalidCredentials');
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  const msg = await screen.findByText(/email or password is not right/i);
  expect(msg.props.accessibilityLiveRegion).toBe('polite');
});

it('never gets stuck loading if onSubmit throws', async () => {
  const onSubmit = jest.fn().mockRejectedValue(new Error('storage down'));
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
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
    await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
    await fill('a@b.com', 'pw');
    await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
    const banner = await screen.findByTestId('banner');
    expect(banner).toHaveStyle({ backgroundColor: color.status.neutral.bg });
  },
);

it('wrong credentials are a danger banner', async () => {
  const onSubmit = jest.fn().mockResolvedValue('invalidCredentials');
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  const banner = await screen.findByTestId('banner');
  expect(banner).toHaveStyle({ backgroundColor: color.status.danger.bg });
});

it('an unconfirmed email starts the confirm flow with the typed email', async () => {
  const onConfirmEmail = jest.fn().mockResolvedValue(undefined);
  await render(
    <SignInScreen
      {...props()}
      onSubmit={jest.fn().mockResolvedValue('emailNotConfirmed')}
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
      {...props()}
      onSubmit={jest.fn().mockResolvedValue('emailNotConfirmed')}
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
  await render(<SignInScreen {...props()} onForgot={onForgot} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'ada@b.co');
  await fireEvent.press(screen.getByRole('link', { name: 'Forgot password?' }));
  expect(onForgot).toHaveBeenCalledWith('ada@b.co');
});

it('the create-account link hands off', async () => {
  const onCreateAccount = jest.fn();
  await render(<SignInScreen {...props()} onCreateAccount={onCreateAccount} />);
  await fireEvent.press(screen.getByRole('link', { name: 'New here? Create account' }));
  expect(onCreateAccount).toHaveBeenCalled();
  expect(screen.queryByText(/bookhushly\.com/)).toBeNull();
});

it('an unconfirmed email is an info banner: a next step, not a refusal', async () => {
  await render(
    <SignInScreen
      {...props()}
      onSubmit={jest.fn().mockResolvedValue('emailNotConfirmed')}
      onConfirmEmail={jest.fn().mockResolvedValue(undefined)}
    />,
  );
  await fill('a@b.co', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(/Confirm your email first/)).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.info.bg });
});

it('a double tap signs in once', async () => {
  let resolve: (v: null) => void = () => undefined;
  const onSubmit = jest.fn(
    () =>
      new Promise<null>((r) => {
        resolve = r;
      }),
  );
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  const button = screen.getByRole('button', { name: 'Sign in' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(null);
    await Promise.resolve();
  });
  expect(button).toBeEnabled();
});

it('a closed account is shown as a refusal (danger), not a network problem', async () => {
  await render(
    <SignInScreen {...props()} onSubmit={jest.fn().mockResolvedValue('accountClosed')} />,
  );
  await fill('a@b.co', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(/This account was closed/)).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.danger.bg });
});

it('a retry that throws replaces the previous refusal instead of keeping it', async () => {
  const onSubmit = jest
    .fn()
    .mockResolvedValueOnce('invalidCredentials')
    .mockRejectedValueOnce(new Error('storage down'));
  await render(<SignInScreen {...props()} onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(/email or password is not right/i)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText(/couldn’t sign you in/i)).toBeTruthy();
  expect(screen.queryByText(/email or password is not right/i)).toBeNull();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.neutral.bg });
});
