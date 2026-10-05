import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { SignInScreen } from '@/features/auth/screens/SignInScreen';

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('Email'), email);
  await fireEvent.changeText(screen.getByLabelText('Password'), password);
}

it('validates inputs before calling onSubmit', async () => {
  const onSubmit = jest.fn();
  await render(<SignInScreen onSubmit={onSubmit} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it('shows the mapped error copy and never blocks retry', async () => {
  const onSubmit = jest.fn().mockResolvedValue('network');
  await render(<SignInScreen onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByText(/couldn’t reach the server/i)).toBeTruthy();
  });
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
});

it('rate limited copy tells the user to wait a minute', async () => {
  const onSubmit = jest.fn().mockResolvedValue('rateLimited');
  await render(<SignInScreen onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByText(/try again in a minute/i)).toBeTruthy();
  });
});

it('passes the normalised email to onSubmit', async () => {
  const onSubmit = jest.fn().mockResolvedValue(null);
  await render(<SignInScreen onSubmit={onSubmit} />);
  await fill('  A@B.COM ', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(onSubmit).toHaveBeenCalledWith('a@b.com', 'pw');
  });
});

it('announces errors politely so screen readers hear them', async () => {
  const onSubmit = jest.fn().mockResolvedValue('invalidCredentials');
  await render(<SignInScreen onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  const msg = await screen.findByText(/email or password is not right/i);
  expect(msg.props.accessibilityLiveRegion).toBe('polite');
});

it('never gets stuck loading if onSubmit throws', async () => {
  const onSubmit = jest.fn().mockRejectedValue(new Error('storage down'));
  await render(<SignInScreen onSubmit={onSubmit} />);
  await fill('a@b.com', 'pw');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in' }));
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeEnabled();
  });
  expect(screen.getByText(/couldn’t sign you in/i)).toBeTruthy();
});

it('the account link label matches its visible text', async () => {
  await render(<SignInScreen onSubmit={jest.fn()} />);
  expect(
    screen.getByRole('link', { name: 'New to Bookhushly? Create your account on bookhushly.com.' }),
  ).toBeTruthy();
});
