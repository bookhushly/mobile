import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AccessibilityInfo, Platform } from 'react-native';

import { CodeScreen } from '@/features/auth/screens/CodeScreen';

let now = 0;
const base = () => ({
  purpose: 'signup' as const,
  email: 'adaeze@gmail.com',
  now: () => now,
  onVerify: jest.fn().mockResolvedValue(null),
  onResend: jest.fn().mockResolvedValue({ ok: true, value: true }),
  onChangeEmail: jest.fn(),
  onVerified: jest.fn(),
  canOpenMail: false,
  onOpenMail: jest.fn(),
});

beforeEach(() => {
  jest.useFakeTimers();
  now = 0;
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

it('announces Verifying… and a wrong code on iOS', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  // The preset's AccessibilityInfo is already a jest.fn: clear calls left by earlier tests.
  const spy = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockClear();
  let resolve: (v: 'badCode') => void = () => undefined;
  const p = {
    ...base(),
    onVerify: jest.fn(
      () =>
        new Promise<'badCode'>((r) => {
          resolve = r;
        }),
    ),
  };
  await render(<CodeScreen {...p} />);
  expect(spy).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Code'), '000000');
  expect(spy.mock.calls.map((c) => c[0])).toEqual(['Verifying…']);
  await act(async () => {
    resolve('badCode');
    await Promise.resolve();
  });
  expect(await screen.findByText('That code is wrong or has expired')).toBeTruthy();
  expect(spy.mock.calls.map((c) => c[0])).toEqual([
    'Verifying…',
    'That code is wrong or has expired',
  ]);
  // The same wrong code again is said again: the line went away in between.
  await fireEvent.changeText(screen.getByLabelText('Code'), '000001');
  await act(async () => {
    resolve('badCode');
    await Promise.resolve();
  });
  await waitFor(() => {
    expect(spy).toHaveBeenCalledTimes(4);
  });
  expect(spy).toHaveBeenLastCalledWith('That code is wrong or has expired');
});

async function tick(ms: number) {
  now += ms;
  await act(() => {
    jest.advanceTimersByTime(ms);
  });
}

it('shows the masked address and verifies once on the sixth digit', async () => {
  const p = base();
  await render(<CodeScreen {...p} />);
  expect(screen.getByText(/a•••e@gmail.com/)).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Code'), '12345');
  expect(p.onVerify).not.toHaveBeenCalled();
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  await waitFor(() => {
    expect(p.onVerified).toHaveBeenCalled();
  });
  expect(p.onVerify).toHaveBeenCalledTimes(1);
  expect(p.onVerify).toHaveBeenCalledWith('123456');
});

it('says Verifying… while the check is in flight', async () => {
  let resolve: (v: null) => void = () => undefined;
  const p = {
    ...base(),
    onVerify: jest.fn(
      () =>
        new Promise<null>((r) => {
          resolve = r;
        }),
    ),
  };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  expect(screen.getByText('Verifying…')).toBeTruthy();
  await act(async () => {
    resolve(null);
    await Promise.resolve();
  });
  expect(screen.queryByText('Verifying…')).toBeNull();
  expect(p.onVerified).toHaveBeenCalledTimes(1);
});

it('a wrong code clears the field and says so', async () => {
  const p = { ...base(), onVerify: jest.fn().mockResolvedValue('badCode') };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '000000');
  expect(await screen.findByText('That code is wrong or has expired')).toBeTruthy();
  expect(screen.getByLabelText('Code').props.value).toBe('');
});

it('after five wrong codes in a row it points at Send a new code', async () => {
  const p = { ...base(), onVerify: jest.fn().mockResolvedValue('badCode') };
  await render(<CodeScreen {...p} />);
  for (let i = 0; i < 5; i += 1) {
    await fireEvent.changeText(screen.getByLabelText('Code'), '000000');
    await waitFor(() => {
      expect(p.onVerify).toHaveBeenCalledTimes(i + 1);
    });
  }
  expect(await screen.findByText('Too many tries. Send a new code.')).toBeTruthy();
  // Verification stays possible.
  await fireEvent.changeText(screen.getByLabelText('Code'), '111111');
  await waitFor(() => {
    expect(p.onVerify).toHaveBeenCalledTimes(6);
  });
});

it('resend waits 60 seconds, then sends and restarts the wait', async () => {
  const p = base();
  await render(<CodeScreen {...p} />);
  expect(screen.getByRole('button', { name: /Send a new code in 1:00/ })).toBeDisabled();
  now = 60_000;
  await act(() => {
    jest.advanceTimersByTime(1_000);
  });
  await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
  expect(p.onResend).toHaveBeenCalledTimes(1);
  expect(await screen.findByText('We sent a new code.')).toBeTruthy();
  expect(screen.getByRole('button', { name: /Send a new code in/ })).toBeDisabled();
});

it('the countdown ticks down second by second', async () => {
  await render(<CodeScreen {...base()} />);
  await tick(18_000);
  expect(screen.getByRole('button', { name: 'Send a new code in 0:42' })).toBeDisabled();
  await tick(42_000);
  expect(screen.getByRole('button', { name: 'Send a new code' })).toBeEnabled();
});

it('a transient resend failure is neutral and can lengthen the wait', async () => {
  const p = {
    ...base(),
    onResend: jest.fn().mockResolvedValue({
      ok: false,
      error: { kind: 'transient', retryAfterSec: 90 },
    }),
  };
  await render(<CodeScreen {...p} />);
  await tick(60_000);
  await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
  expect(await screen.findByText(/try again in 90 seconds/i)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Send a new code in 1:30' })).toBeDisabled();
  expect(screen.queryByText('We sent a new code.')).toBeNull();
});

it('a resend in flight never blocks the sixth digit', async () => {
  let resolve: (v: { ok: true; value: true }) => void = () => undefined;
  const p = {
    ...base(),
    onResend: jest.fn(
      () =>
        new Promise<{ ok: true; value: true }>((r) => {
          resolve = r;
        }),
    ),
  };
  await render(<CodeScreen {...p} />);
  await tick(60_000);
  await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
  expect(p.onResend).toHaveBeenCalledTimes(1);
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  await waitFor(() => {
    expect(p.onVerify).toHaveBeenCalledTimes(1);
  });
  expect(p.onVerify).toHaveBeenCalledWith('123456');
  await act(async () => {
    resolve({ ok: true, value: true });
    await Promise.resolve();
  });
  expect(await screen.findByText('We sent a new code.')).toBeTruthy();
});

it('Send a new code is disabled while a verify is in flight', async () => {
  let resolve: (v: null) => void = () => undefined;
  const p = {
    ...base(),
    onVerify: jest.fn(
      () =>
        new Promise<null>((r) => {
          resolve = r;
        }),
    ),
  };
  await render(<CodeScreen {...p} />);
  await tick(60_000);
  expect(screen.getByRole('button', { name: 'Send a new code' })).toBeEnabled();
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  expect(screen.getByRole('button', { name: 'Send a new code' })).toBeDisabled();
  await act(async () => {
    resolve(null);
    await Promise.resolve();
  });
  expect(p.onVerified).toHaveBeenCalledTimes(1);
});

it('a non-transient resend failure says the code was not sent', async () => {
  const p = {
    ...base(),
    onResend: jest.fn().mockResolvedValue({ ok: false, error: { kind: 'failed' } }),
  };
  await render(<CodeScreen {...p} />);
  await tick(60_000);
  await fireEvent.press(screen.getByRole('button', { name: 'Send a new code' }));
  expect(await screen.findByText('We couldn’t send a new code. Try again.')).toBeTruthy();
  expect(screen.queryByText(/reach Bookhushly/)).toBeNull();
  // Not a rate limit: the wait is not restarted.
  expect(screen.getByRole('button', { name: 'Send a new code' })).toBeEnabled();
});

it('Try again re-sends the kept code after a transient verify failure', async () => {
  const p = {
    ...base(),
    onVerify: jest.fn().mockResolvedValueOnce('transient').mockResolvedValueOnce(null),
  };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  await fireEvent.press(await screen.findByRole('link', { name: 'Try again' }));
  await waitFor(() => {
    expect(p.onVerified).toHaveBeenCalledTimes(1);
  });
  expect(p.onVerify).toHaveBeenCalledTimes(2);
  expect(p.onVerify).toHaveBeenLastCalledWith('123456');
  expect(screen.queryByRole('link', { name: 'Try again' })).toBeNull();
});

it('Try again is not offered for a wrong code', async () => {
  const p = { ...base(), onVerify: jest.fn().mockResolvedValue('badCode') };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '000000');
  expect(await screen.findByText('That code is wrong or has expired')).toBeTruthy();
  expect(screen.queryByRole('link', { name: 'Try again' })).toBeNull();
});

it('a transient verify failure is neutral and keeps the code', async () => {
  const p = { ...base(), onVerify: jest.fn().mockResolvedValue('transient') };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  expect(await screen.findByTestId('banner')).toBeTruthy();
  expect(screen.getByLabelText('Code').props.value).toBe('123456');
  expect(screen.queryByText('Verifying…')).toBeNull();
});

it('a thrown verify never leaves Verifying… stuck', async () => {
  const p = { ...base(), onVerify: jest.fn().mockRejectedValue(new Error('boom')) };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  expect(await screen.findByText(/try again in a minute/i)).toBeTruthy();
  expect(screen.queryByText('Verifying…')).toBeNull();
  expect(p.onVerified).not.toHaveBeenCalled();
});

it('an unknown verify result asks to try again without blaming the code', async () => {
  const p = { ...base(), onVerify: jest.fn().mockResolvedValue('unknown') };
  await render(<CodeScreen {...p} />);
  await fireEvent.changeText(screen.getByLabelText('Code'), '123456');
  expect(await screen.findByText('We couldn’t check that code. Try again.')).toBeTruthy();
  expect(screen.getByLabelText('Code').props.value).toBe('123456');
});

it('titles follow the purpose', async () => {
  const p = base();
  const r = await render(<CodeScreen {...p} />);
  expect(screen.getByRole('header', { name: 'Enter the 6-digit code' })).toBeTruthy();
  await r.rerender(<CodeScreen {...p} purpose="confirm" />);
  expect(screen.getByRole('header', { name: 'Confirm your email first' })).toBeTruthy();
  await r.rerender(<CodeScreen {...p} purpose="recovery" />);
  expect(screen.getByRole('header', { name: 'Enter your reset code' })).toBeTruthy();
});

it('Change goes back; Open email app only shows when it can open', async () => {
  const p = base();
  const r = await render(<CodeScreen {...p} />);
  await fireEvent.press(screen.getByRole('link', { name: 'Change' }));
  expect(p.onChangeEmail).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole('link', { name: 'Open email app' })).toBeNull();
  await r.rerender(<CodeScreen {...p} canOpenMail />);
  await fireEvent.press(screen.getByRole('link', { name: 'Open email app' }));
  expect(p.onOpenMail).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Check spam or junk/)).toBeTruthy();
});
