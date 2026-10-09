import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { ForgotPasswordScreen } from '@/features/auth/screens/ForgotPasswordScreen';

it('always continues to the code screen after a 202, with the lower-cased email', async () => {
  const onSent = jest.fn();
  const onSubmit = jest.fn().mockResolvedValue({ ok: true, value: true });
  await render(<ForgotPasswordScreen initialEmail="" onSubmit={onSubmit} onSent={onSent} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), ' Ada@B.co ');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await waitFor(() => {
    expect(onSent).toHaveBeenCalledWith('ada@b.co');
  });
  expect(onSubmit).toHaveBeenCalledWith('ada@b.co');
});

it('pre-fills the email handed over from sign-in', async () => {
  const onSent = jest.fn();
  await render(
    <ForgotPasswordScreen
      initialEmail="ada@b.co"
      onSubmit={jest.fn().mockResolvedValue({ ok: true, value: true })}
      onSent={onSent}
    />,
  );
  expect(screen.getByLabelText('Email').props.value).toBe('ada@b.co');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await waitFor(() => {
    expect(onSent).toHaveBeenCalledWith('ada@b.co');
  });
});

it('a transient failure stays on the screen, neutral', async () => {
  const onSent = jest.fn();
  await render(
    <ForgotPasswordScreen
      initialEmail="ada@b.co"
      onSubmit={jest.fn().mockResolvedValue({ ok: false, error: { kind: 'transient' } })}
      onSent={onSent}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(screen.getByText(/try again in a minute/)).toBeTruthy();
  expect(onSent).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Send code' })).toBeEnabled();
});

it('a transient failure names the wait when the server gives one', async () => {
  await render(
    <ForgotPasswordScreen
      initialEmail="ada@b.co"
      onSubmit={jest
        .fn()
        .mockResolvedValue({ ok: false, error: { kind: 'transient', retryAfterSec: 42 } })}
      onSent={jest.fn()}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(await screen.findByText(/try again in 42 seconds/)).toBeTruthy();
});

it('an invalid email is a field error, and never calls the server', async () => {
  const onSubmit = jest.fn();
  await render(<ForgotPasswordScreen initialEmail="" onSubmit={onSubmit} onSent={jest.fn()} />);
  await fireEvent.changeText(screen.getByLabelText('Email'), 'not-an-email');
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("the server's invalid_input shows under the field", async () => {
  const onSent = jest.fn();
  await render(
    <ForgotPasswordScreen
      initialEmail="ada@b.co"
      onSubmit={jest.fn().mockResolvedValue({
        ok: false,
        error: { kind: 'invalid', fields: { email: 'Enter a valid email address' } },
      })}
      onSent={onSent}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  expect(onSent).not.toHaveBeenCalled();
});

it('any other failure still continues (no account-existence leak)', async () => {
  const onSent = jest.fn();
  await render(
    <ForgotPasswordScreen
      initialEmail="ada@b.co"
      onSubmit={jest.fn().mockResolvedValue({ ok: false, error: { kind: 'failed' } })}
      onSent={onSent}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  await waitFor(() => {
    expect(onSent).toHaveBeenCalledWith('ada@b.co');
  });
  expect(screen.queryByTestId('banner')).toBeNull();
});

it('a rejected submit reads as transient', async () => {
  const onSent = jest.fn();
  await render(
    <ForgotPasswordScreen
      initialEmail="ada@b.co"
      onSubmit={jest.fn().mockRejectedValue(new Error('boom'))}
      onSent={onSent}
    />,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Send code' }));
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(onSent).not.toHaveBeenCalled();
});

it('shows the no-leak copy under the field and a back button when given', async () => {
  const onBack = jest.fn();
  await render(
    <ForgotPasswordScreen
      initialEmail=""
      onSubmit={jest.fn()}
      onSent={jest.fn()}
      onBack={onBack}
    />,
  );
  expect(
    screen.getByText("If an account uses this email, we'll send a 6-digit code."),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalled();
});

it('a double tap sends once', async () => {
  let resolve: (v: { ok: true; value: true }) => void = () => {};
  const onSubmit = jest.fn().mockReturnValue(
    new Promise<{ ok: true; value: true }>((r) => {
      resolve = r;
    }),
  );
  const onSent = jest.fn();
  await render(<ForgotPasswordScreen initialEmail="ada@b.co" onSubmit={onSubmit} onSent={onSent} />);
  const button = screen.getByRole('button', { name: 'Send code' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(onSubmit).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  resolve({ ok: true, value: true });
  await waitFor(() => {
    expect(onSent).toHaveBeenCalledTimes(1);
  });
});
