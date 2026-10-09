import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { NewPasswordScreen } from '@/features/auth/screens/NewPasswordScreen';

const VALID = 'Abcdefg1!';

function props() {
  return {
    onSave: jest.fn().mockResolvedValue({ ok: true, value: true }),
    onSaved: jest.fn(),
    onLeave: jest.fn(),
  };
}

async function typeAndSave(password: string) {
  await fireEvent.changeText(screen.getByLabelText('New password'), password);
  await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
}

it('saves a valid password', async () => {
  const p = props();
  await render(<NewPasswordScreen {...p} />);
  expect(screen.getByRole('button', { name: 'Save password' })).toBeDisabled();
  await typeAndSave(VALID);
  await waitFor(() => {
    expect(p.onSaved).toHaveBeenCalled();
  });
  expect(p.onSave).toHaveBeenCalledWith(VALID);
  expect(p.onLeave).not.toHaveBeenCalled();
});

it('stays disabled until every rule is met, and shows the checklist', async () => {
  const p = props();
  await render(<NewPasswordScreen {...p} />);
  expect(screen.getByText('At least 8 characters')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('New password'), 'abcdefg1!');
  expect(screen.getByRole('button', { name: 'Save password' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('button', { name: 'Save password' }));
  expect(p.onSave).not.toHaveBeenCalled();
});

it('says when the password is too long', async () => {
  await render(<NewPasswordScreen {...props()} />);
  await fireEvent.changeText(screen.getByLabelText('New password'), `${'A'.repeat(70)}bc1!`);
  expect(screen.getByText('That password is too long')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save password' })).toBeDisabled();
});

it('cancel leaves (signs out)', async () => {
  const p = props();
  await render(<NewPasswordScreen {...p} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(p.onLeave).toHaveBeenCalled();
});

it('an expired reset offers to start again', async () => {
  const p = props();
  p.onSave.mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } });
  await render(<NewPasswordScreen {...p} />);
  await typeAndSave(VALID);
  expect(await screen.findByText('Your reset expired. Start again.')).toBeTruthy();
  await fireEvent.press(await screen.findByRole('button', { name: 'Start again' }));
  expect(p.onLeave).toHaveBeenCalled();
  expect(p.onSaved).not.toHaveBeenCalled();
});

it("the server's weak_password shows under the field", async () => {
  const p = props();
  p.onSave.mockResolvedValue({
    ok: false,
    error: { kind: 'weakPassword', fields: { password: 'Use a number' } },
  });
  await render(<NewPasswordScreen {...p} />);
  await typeAndSave(VALID);
  expect(await screen.findByText('Use a number')).toBeTruthy();
  expect(screen.queryByTestId('banner')).toBeNull();
  expect(p.onSaved).not.toHaveBeenCalled();
});

it('a transient failure is a neutral banner and keeps the input', async () => {
  const p = props();
  p.onSave.mockResolvedValue({ ok: false, error: { kind: 'transient', retryAfterSec: 30 } });
  await render(<NewPasswordScreen {...p} />);
  await typeAndSave(VALID);
  expect(await screen.findByText(/try again in 30 seconds/)).toBeTruthy();
  expect(screen.getByLabelText('New password').props.value).toBe(VALID);
  expect(screen.getByRole('button', { name: 'Save password' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Start again' })).toBeNull();
});

it('a failed save says so without blame', async () => {
  const p = props();
  p.onSave.mockResolvedValue({ ok: false, error: { kind: 'failed' } });
  await render(<NewPasswordScreen {...p} />);
  await typeAndSave(VALID);
  expect(await screen.findByText('We couldn’t save your password. Try again.')).toBeTruthy();
});

it('a rejected save reads as a failed save', async () => {
  const p = props();
  p.onSave.mockRejectedValue(new Error('boom'));
  await render(<NewPasswordScreen {...p} />);
  await typeAndSave(VALID);
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(p.onSaved).not.toHaveBeenCalled();
});

it('a double tap saves once', async () => {
  let resolve: (v: { ok: true; value: true }) => void = () => {};
  const p = props();
  p.onSave.mockReturnValue(
    new Promise<{ ok: true; value: true }>((r) => {
      resolve = r;
    }),
  );
  await render(<NewPasswordScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('New password'), VALID);
  const button = screen.getByRole('button', { name: 'Save password' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(p.onSave).toHaveBeenCalledTimes(1);
  expect(button).toBeDisabled();
  resolve({ ok: true, value: true });
  await waitFor(() => {
    expect(p.onSaved).toHaveBeenCalledTimes(1);
  });
});
