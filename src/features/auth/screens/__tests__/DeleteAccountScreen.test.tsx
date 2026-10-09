import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { DeleteAccountScreen } from '@/features/auth/screens/DeleteAccountScreen';

const base = () => ({
  email: 'ada@b.co',
  unsynced: 0,
  onCheckPassword: jest.fn().mockResolvedValue('ok'),
  onDelete: jest.fn().mockResolvedValue({ ok: true, value: true }),
  onConfirmDeletedAfterUncertain: jest.fn().mockResolvedValue(false),
  onDeleted: jest.fn(),
  onCancel: jest.fn(),
});

async function confirm(pw = 'Abcdefg1!') {
  await fireEvent.changeText(screen.getByLabelText('Password'), pw);
  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'DELETE');
}

const button = () => screen.getByRole('button', { name: 'Delete account' });

it('shows whose account this is and what deletion does', async () => {
  await render(<DeleteAccountScreen {...base()} />);
  expect(screen.getByText('ada@b.co')).toBeTruthy();
  expect(screen.getByText(/This can't be undone/)).toBeTruthy();
  expect(screen.queryByTestId('banner')).toBeNull();
});

it('needs the password and DELETE before the button works', async () => {
  await render(<DeleteAccountScreen {...base()} />);
  expect(button()).toBeDisabled();
  await fireEvent.changeText(screen.getByLabelText('Password'), 'Abcdefg1!');
  await fireEvent.changeText(screen.getByLabelText('Type DELETE to confirm'), 'delete');
  expect(button()).toBeDisabled();
  await confirm();
  expect(button()).toBeEnabled();
});

it('checks the password in the app, then deletes once', async () => {
  const p = base();
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  const b = button();
  await fireEvent.press(b);
  await fireEvent.press(b);
  await waitFor(() => {
    expect(p.onDeleted).toHaveBeenCalled();
  });
  expect(p.onCheckPassword).toHaveBeenCalledWith('Abcdefg1!');
  expect(p.onDelete).toHaveBeenCalledTimes(1);
});

it('a wrong password never reaches the server', async () => {
  const p = { ...base(), onCheckPassword: jest.fn().mockResolvedValue('wrong') };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  expect(await screen.findByText("That password isn't right")).toBeTruthy();
  expect(p.onDelete).not.toHaveBeenCalled();
});

it('an outage during the password check is neutral, not "wrong password"', async () => {
  const p = { ...base(), onCheckPassword: jest.fn().mockResolvedValue('transient') };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(screen.queryByText("That password isn't right")).toBeNull();
  expect(p.onDelete).not.toHaveBeenCalled();
});

it('a closed account during the password check means the delete already went through', async () => {
  const p = { ...base(), onCheckPassword: jest.fn().mockResolvedValue('closed') };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  await waitFor(() => {
    expect(p.onDeleted).toHaveBeenCalled();
  });
  expect(p.onDelete).not.toHaveBeenCalled();
});

it('lists every blocker', async () => {
  const p = {
    ...base(),
    onDelete: jest.fn().mockResolvedValue({
      ok: false,
      error: {
        kind: 'blocked',
        reasons: [
          { code: 'has_active_bookings', detail: 'You have a booking that has not ended yet.' },
          { code: 'has_wallet_balance', detail: 'Your wallet still has money in it.' },
        ],
      },
    }),
  };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  expect(await screen.findByText("You can't delete your account yet")).toBeTruthy();
  expect(screen.getByText(/You have a booking that has not ended yet\./)).toBeTruthy();
  expect(screen.getByText(/Your wallet still has money in it\./)).toBeTruthy();
  expect(p.onDeleted).not.toHaveBeenCalled();
});

it('shows the server message for a staff account', async () => {
  const p = {
    ...base(),
    onDelete: jest.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'notCustomer', message: 'Business and staff accounts are closed through support.' },
    }),
  };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  expect(
    await screen.findByText('Business and staff accounts are closed through support.'),
  ).toBeTruthy();
  expect(p.onDeleted).not.toHaveBeenCalled();
});

it('a lost response resolves through the banned-session check', async () => {
  const p = {
    ...base(),
    onDelete: jest.fn().mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } }),
    onConfirmDeletedAfterUncertain: jest.fn().mockResolvedValue(true),
  };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  await waitFor(() => {
    expect(p.onDeleted).toHaveBeenCalled();
  });
});

it('an unconfirmed lost response asks the user to sign in again to check', async () => {
  const p = {
    ...base(),
    onDelete: jest.fn().mockResolvedValue({ ok: false, error: { kind: 'unauthorized' } }),
  };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  expect(
    await screen.findByText("We couldn't confirm the deletion. Sign in again to check."),
  ).toBeTruthy();
  expect(p.onDeleted).not.toHaveBeenCalled();
});

it('a failed delete is safe to retry', async () => {
  const p = {
    ...base(),
    onDelete: jest
      .fn()
      .mockResolvedValueOnce({ ok: false, error: { kind: 'failed' } })
      .mockResolvedValueOnce({ ok: true, value: true }),
  };
  await render(<DeleteAccountScreen {...p} />);
  await confirm();
  await fireEvent.press(button());
  expect(await screen.findByText("We couldn't delete your account. Try again.")).toBeTruthy();
  await fireEvent.press(button());
  await waitFor(() => {
    expect(p.onDeleted).toHaveBeenCalled();
  });
  expect(p.onDelete).toHaveBeenCalledTimes(2);
});

it('warns about unsynced admissions first', async () => {
  await render(<DeleteAccountScreen {...base()} unsynced={3} />);
  expect(screen.getByText(/3 admissions haven't synced/)).toBeTruthy();
});

it('says "some" when the unsynced count could not be read', async () => {
  await render(<DeleteAccountScreen {...base()} unsynced={-1} />);
  expect(screen.getByText('Some admissions may not have synced.')).toBeTruthy();
});

it('cancel goes back', async () => {
  const p = base();
  await render(<DeleteAccountScreen {...p} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(p.onCancel).toHaveBeenCalled();
});
