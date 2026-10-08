import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import type { PinCheck } from '@/features/gate/offline/offlineGate';
import { PinSheet } from '@/features/gate/ui/PinSheet';
import { color } from '@/shared/theme';

type Purpose = 'override' | 'lookup';

async function setup(purpose: Purpose, check: (pin: string) => Promise<PinCheck>) {
  const onApproved = jest.fn();
  await render(
    <PinSheet
      visible
      purpose={purpose}
      check={check}
      onApproved={onApproved}
      onClose={jest.fn()}
    />,
  );
  return onApproved;
}

const fill = async (pin: string, who: string, reason?: string) => {
  await fireEvent.changeText(screen.getByLabelText('PIN'), pin);
  await fireEvent.changeText(screen.getByLabelText('Approver'), who);
  if (reason !== undefined) await fireEvent.changeText(screen.getByLabelText(/^Reason/), reason);
};
const confirm = () => screen.getByRole('button', { name: /^(Confirm|Checking…)$/ });

it('keeps Confirm disabled until the PIN, approver and (override) reason are valid', async () => {
  await setup('override', () => Promise.resolve({ kind: 'ok' }));
  expect(confirm()).toBeDisabled();
  await fill('12345', 'Ada', 'late');
  expect(confirm()).toBeDisabled();
  await fill('123456', '  ', 'late');
  expect(confirm()).toBeDisabled();
  await fill('123456', 'Ada', 'no');
  expect(confirm()).toBeDisabled();
  await fill('123456', 'Ada', 'lost ticket');
  expect(confirm()).toBeEnabled();
});

it('does not need a reason for a lookup', async () => {
  await setup('lookup', () => Promise.resolve({ kind: 'ok' }));
  await fill('123456', 'Ada');
  expect(confirm()).toBeEnabled();
  expect(screen.getByText('Supervisor approval')).toBeTruthy();
  expect(
    screen.getByText('A supervisor enters the event PIN. Every approval is logged.'),
  ).toBeTruthy();
  expect(screen.queryByText(/override/i)).toBeNull();
});

it('keeps the override wording for an override', async () => {
  await setup('override', () => Promise.resolve({ kind: 'locked', minutesLeft: 12 }));
  expect(
    screen.getByText('A supervisor enters the event PIN. Every override is logged.'),
  ).toBeTruthy();
  await fill('123456', 'Ada', 'lost ticket');
  await fireEvent.press(confirm());
  expect(await screen.findByText('Override locked — try again in 12 min')).toBeTruthy();
});

it('says override is unavailable for an override', async () => {
  await setup('override', () => Promise.resolve({ kind: 'unavailable' }));
  await fill('123456', 'Ada', 'lost ticket');
  await fireEvent.press(confirm());
  expect(await screen.findByText('Override isn’t available for this event')).toBeTruthy();
});

it('never runs two checks at once', async () => {
  let resolve: (v: PinCheck) => void = () => undefined;
  const check = jest.fn(
    () =>
      new Promise<PinCheck>((r) => {
        resolve = r;
      }),
  );
  const onApproved = await setup('lookup', check);
  await fill('123456', 'Ada');
  await fireEvent.press(confirm());
  await fireEvent.press(confirm());
  expect(check).toHaveBeenCalledTimes(1);
  expect(screen.getByText('Checking…')).toBeTruthy();
  resolve({ kind: 'ok' });
  await waitFor(() => {
    expect(onApproved).toHaveBeenCalledTimes(1);
  });
});

it('shows the tries left and clears the PIN on a wrong PIN', async () => {
  await setup('lookup', () => Promise.resolve({ kind: 'wrong', triesLeft: 3 }));
  await fill('123456', 'Ada');
  await fireEvent.press(confirm());
  expect(await screen.findByText('Wrong PIN — 3 tries left')).toBeTruthy();
  expect(screen.getByLabelText('PIN').props.value).toBe('');
});

it('shows the lock and keeps Confirm disabled when locked', async () => {
  await setup('lookup', () => Promise.resolve({ kind: 'locked', minutesLeft: 12 }));
  await fill('123456', 'Ada');
  await fireEvent.press(confirm());
  expect(await screen.findByText('Approval locked — try again in 12 min')).toBeTruthy();
  await fill('123456', 'Ada');
  expect(confirm()).toBeDisabled();
});

it('says so when approval is not set up for a lookup', async () => {
  await setup('lookup', () => Promise.resolve({ kind: 'unavailable' }));
  await fill('123456', 'Ada');
  await fireEvent.press(confirm());
  expect(
    await screen.findByText(
      'Supervisor approval isn’t set up for this event — ask the organiser to set an offline PIN',
    ),
  ).toBeTruthy();
});

it('recovers when the check rejects', async () => {
  await setup('lookup', () => Promise.reject(new Error('store')));
  await fill('123456', 'Ada');
  await fireEvent.press(confirm());
  expect(await screen.findByText('Approval isn’t available right now — try again')).toBeTruthy();
  expect(confirm()).toBeEnabled();
});

it('approves with trimmed values and a null reason when a lookup reason is empty', async () => {
  const onApproved = await setup('lookup', () => Promise.resolve({ kind: 'ok' }));
  await fill('123456', '  Ada  ', '   ');
  await fireEvent.press(confirm());
  await waitFor(() => {
    expect(onApproved).toHaveBeenCalledWith({ approvedBy: 'Ada', reason: null });
  });
  expect(onApproved).toHaveBeenCalledTimes(1);
});

it('passes a trimmed reason for an override', async () => {
  const onApproved = await setup('override', () => Promise.resolve({ kind: 'ok' }));
  await fill('123456', 'Ada', '  lost ticket ');
  await fireEvent.press(confirm());
  await waitFor(() => {
    expect(onApproved).toHaveBeenCalledWith({ approvedBy: 'Ada', reason: 'lost ticket' });
  });
});

it('ignores a stale check after close and reopen', async () => {
  let resolve: (v: PinCheck) => void = () => undefined;
  const check = jest.fn(
    () =>
      new Promise<PinCheck>((r) => {
        resolve = r;
      }),
  );
  const onApproved = jest.fn();
  const ui = (visible: boolean) => (
    <PinSheet
      visible={visible}
      purpose="lookup"
      check={check}
      onApproved={onApproved}
      onClose={jest.fn()}
    />
  );
  const { rerender } = await render(ui(true));
  await fill('123456', 'Ada');
  await fireEvent.press(confirm());
  await rerender(ui(false));
  await rerender(ui(true));
  resolve({ kind: 'ok' });
  await act(async () => {
    await Promise.resolve();
  });
  expect(onApproved).not.toHaveBeenCalled();
  expect(confirm()).toBeDisabled();
});

it('clears the fields when closed', async () => {
  const check = () => Promise.resolve<PinCheck>({ kind: 'ok' });
  const ui = (visible: boolean) => (
    <PinSheet
      visible={visible}
      purpose="override"
      check={check}
      onApproved={jest.fn()}
      onClose={jest.fn()}
    />
  );
  const { rerender } = await render(ui(true));
  await fill('123456', 'Ada', 'lost ticket');
  await rerender(ui(false));
  await rerender(ui(true));
  expect(screen.getByLabelText('PIN').props.value).toBe('');
  expect(screen.getByLabelText('Approver').props.value).toBe('');
  expect(screen.getByLabelText('Reason').props.value).toBe('');
});

it('a transient check failure is neutral, a wrong PIN is danger', async () => {
  const check = jest
    .fn()
    .mockRejectedValueOnce(new Error('x'))
    .mockResolvedValueOnce({ kind: 'wrong', triesLeft: 4 });
  await render(
    <PinSheet
      visible
      purpose="override"
      check={check}
      onApproved={jest.fn()}
      onClose={jest.fn()}
    />,
  );
  await fireEvent.changeText(screen.getByLabelText('PIN'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Approver'), 'Ada');
  await fireEvent.changeText(screen.getByLabelText('Reason'), 'Phone died');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('Override isn’t available right now — try again')).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.neutral.bg });
  await fireEvent.changeText(screen.getByLabelText('PIN'), '123456');
  await fireEvent.press(screen.getByRole('button', { name: 'Confirm' }));
  expect(await screen.findByText('Wrong PIN — 4 tries left')).toBeTruthy();
  expect(screen.getByTestId('banner')).toHaveStyle({ backgroundColor: color.status.danger.bg });
});

it('closes from the header and has no separate Cancel button', async () => {
  const onClose = jest.fn();
  await render(
    <PinSheet
      visible
      purpose="override"
      check={() => Promise.resolve<PinCheck>({ kind: 'ok' })}
      onApproved={jest.fn()}
      onClose={onClose}
    />,
  );
  expect(screen.getByRole('header', { name: 'Supervisor override' })).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});
