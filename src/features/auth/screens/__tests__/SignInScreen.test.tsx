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
