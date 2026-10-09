import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { AccountFailure } from '@/features/auth/api/accountApi';
import { SignUpScreen } from '@/features/auth/screens/SignUpScreen';
import type { Result } from '@/shared/lib/result';

type SubmitResult = Result<{ email: string }, AccountFailure>;

const ok = (email: string): Promise<SubmitResult> =>
  Promise.resolve({ ok: true as const, value: { email } });
const fail = (error: AccountFailure): Promise<SubmitResult> =>
  Promise.resolve({ ok: false as const, error });

// Fresh mocks per test so no assertion can depend on test order.
const props = () => ({
  onSubmit: jest.fn(() => ok('ada@b.co')),
  onVerified: jest.fn(),
  onVerifyExisting: jest.fn().mockResolvedValue(undefined),
  onSignIn: jest.fn(),
  onOpenLink: jest.fn(),
});

async function fillValid() {
  await fireEvent.changeText(screen.getByLabelText('Name'), 'Ada Obi');
  await fireEvent.changeText(screen.getByLabelText('Email'), ' Ada@B.co ');
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Abcdefg1!');
}

it('create account stays disabled until every rule is met', async () => {
  await render(<SignUpScreen {...props()} />);
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  await fillValid();
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
  await fireEvent.changeText(screen.getByLabelText('Password'), 'abcdefg1!');
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
  expect(screen.getByLabelText('An upper-case letter, not yet')).toBeTruthy();
});

it('the checklist is neutral until the password is touched', async () => {
  await render(<SignUpScreen {...props()} />);
  expect(screen.getByLabelText('At least 8 characters, not yet')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Abcdefg1!');
  expect(screen.getByLabelText('At least 8 characters, done')).toBeTruthy();
});

it('a password over 72 bytes is flagged and blocks submit', async () => {
  await render(<SignUpScreen {...props()} />);
  await fillValid();
  await fireEvent.changeText(screen.getByLabelText('Password'), `Aa1!${'x'.repeat(70)}`);
  expect(screen.getByText('That password is too long')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled();
});

it('submits trimmed lower-case email and goes to the code screen', async () => {
  const p = props();
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  await waitFor(() => {
    expect(p.onVerified).toHaveBeenCalledWith('ada@b.co');
  });
  expect(p.onSubmit).toHaveBeenCalledWith({
    name: 'Ada Obi',
    email: 'ada@b.co',
    password: 'Abcdefg1!',
  });
});

it('409 offers Verify this email which resends and opens the code screen', async () => {
  const p = { ...props(), onSubmit: jest.fn(() => fail({ kind: 'emailTaken' })) };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('This email already has an account.')).toBeTruthy();
  await fireEvent.press(await screen.findByRole('button', { name: 'Verify this email' }));
  expect(p.onVerifyExisting).toHaveBeenCalledWith('ada@b.co');
  await fireEvent.press(screen.getByRole('button', { name: 'Sign in instead' }));
  expect(p.onSignIn).toHaveBeenCalled();
});

it('a double tap on Verify this email resends once', async () => {
  let resolve: () => void = () => undefined;
  const p = {
    ...props(),
    onSubmit: jest.fn(() => fail({ kind: 'emailTaken' })),
    onVerifyExisting: jest.fn(
      () =>
        new Promise<void>((r) => {
          resolve = r;
        }),
    ),
  };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  const b = await screen.findByRole('button', { name: 'Verify this email' });
  await fireEvent.press(b);
  await fireEvent.press(b);
  expect(p.onVerifyExisting).toHaveBeenCalledTimes(1);
  resolve();
  await waitFor(() => {
    expect(b).not.toBeBusy();
  });
});

it('server field errors appear under the fields; transient is neutral', async () => {
  const p = {
    ...props(),
    onSubmit: jest
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        error: { kind: 'invalid', fields: { email: 'Enter a valid email address' } },
      })
      .mockResolvedValueOnce({ ok: false, error: { kind: 'transient', retryAfterSec: 20 } }),
  };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Enter a valid email address')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText(/try again in 20 seconds/i)).toBeTruthy();
  // The field error from the first attempt does not outlive the retry.
  expect(screen.queryByText('Enter a valid email address')).toBeNull();
});

it('weak password from the server shows under the password field', async () => {
  const p = {
    ...props(),
    onSubmit: jest.fn(() =>
      fail({ kind: 'weakPassword', fields: { password: 'Use an upper-case letter' } }),
    ),
  };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Use an upper-case letter')).toBeTruthy();
});

it('a 400 without fields shows a neutral check-your-details banner', async () => {
  const p = { ...props(), onSubmit: jest.fn(() => fail({ kind: 'invalid', fields: {} })) };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('Check your details and try again.')).toBeTruthy();
});

it('transient without seconds and failed both use neutral copy', async () => {
  const p = {
    ...props(),
    onSubmit: jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'transient' } })
      .mockResolvedValueOnce({ ok: false, error: { kind: 'failed' } }),
  };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText(/try again in a minute/i)).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Create account' }));
  expect(await screen.findByText('We couldn’t create your account. Try again.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled();
});

it('a double tap sends one request', async () => {
  let resolve: (v: SubmitResult) => void = () => undefined;
  const p = {
    ...props(),
    onSubmit: jest.fn(
      () =>
        new Promise<SubmitResult>((r) => {
          resolve = r;
        }),
    ),
  };
  await render(<SignUpScreen {...p} />);
  await fillValid();
  const b = screen.getByRole('button', { name: 'Create account' });
  await fireEvent.press(b);
  await fireEvent.press(b);
  expect(p.onSubmit).toHaveBeenCalledTimes(1);
  expect(b).toBeBusy();
  resolve({ ok: true, value: { email: 'ada@b.co' } });
  await waitFor(() => {
    expect(p.onVerified).toHaveBeenCalledWith('ada@b.co');
  });
});

it('footer links go to sign in and open the terms and privacy pages', async () => {
  const p = props();
  await render(<SignUpScreen {...p} />);
  await fireEvent.press(screen.getByRole('link', { name: 'Already have an account? Sign in' }));
  expect(p.onSignIn).toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('link', { name: 'Terms' }));
  await fireEvent.press(screen.getByRole('link', { name: 'Privacy policy' }));
  expect(p.onOpenLink).toHaveBeenCalledWith('https://bookhushly.com/terms');
  expect(p.onOpenLink).toHaveBeenCalledWith('https://bookhushly.com/privacy');
});
