import type { QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';

import { claim, claimCounts, sendClaimCode } from '@/features/customer/api/claimApi';
import { fromEvent, splitBookings } from '@/features/customer/domain/myBookings';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { useMyBookings } from '@/features/customer/hooks/useMyBookings';
import type { ClaimResult } from '@/features/customer/schemas/actions';
import { BookingsScreen } from '@/features/customer/screens/BookingsScreen';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { ev, makeQueryClient, TODAY, USER, wrapper } from '../../hooks/__tests__/customerTestUtils';

jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => Date.now() } }));
jest.mock('@/features/customer/hooks/useMyBookings', () => ({ useMyBookings: jest.fn() }));
jest.mock('@/features/customer/hooks/useUnreadCount', () => ({ useUnreadCount: () => 0 }));
jest.mock('@/features/customer/api/claimApi', () => ({
  claimCounts: jest.fn(),
  sendClaimCode: jest.fn(),
  claim: jest.fn(),
}));

const countsMock = jest.mocked(claimCounts);
const sendMock = jest.mocked(sendClaimCode);
const claimMock = jest.mocked(claim);
const myMock = jest.mocked(useMyBookings);

const EMAIL = 'ada@gmail.com';
const COUNTS = { events: 2, hotels: 1, apartments: 0, total: 3 };
const NOW = Date.parse('2026-10-19T10:00:00Z');

function bookings(withOne: boolean) {
  const rows = { events: withOne ? [ev()] : [], hotels: [], apartments: [] };
  myMock.mockReturnValue({
    bookings: splitBookings(withOne ? [fromEvent(ev(), TODAY)] : []),
    rows,
    saved: null,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
}

let qc: QueryClient;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  qc = makeQueryClient();
  countsMock.mockResolvedValue(ok(COUNTS));
  sendMock.mockResolvedValue(ok({ sent: true }));
  bookings(true);
});
afterEach(() => {
  qc.clear();
  jest.useRealTimers();
});

async function show() {
  await render(
    <BookingsScreen
      userId={USER}
      email={EMAIL}
      onOpenBooking={jest.fn()}
      onShowTickets={jest.fn()}
      onShowCheckInCode={jest.fn()}
      onOpenNotifications={jest.fn()}
      onBrowse={jest.fn()}
    />,
    { wrapper: wrapper(qc) },
  );
  await waitFor(() => {
    expect(countsMock).toHaveBeenCalled();
  });
}

async function openSheet() {
  await show();
  await fireEvent.press(await screen.findByRole('button', { name: 'Add them' }));
  return screen.getByTestId('claim-sheet');
}

async function toCodeStep() {
  const sheet = await openSheet();
  await fireEvent.press(within(sheet).getByRole('button', { name: 'Send code' }));
  await screen.findByText('Enter the 6-digit code');
  return sheet;
}

describe('the card', () => {
  it('offers the guest bookings with the masked email, and can be dismissed', async () => {
    await show();
    expect(
      await screen.findByText('3 bookings made with a•••a@gmail.com can be added to your account.'),
    ).toBeTruthy();
    expect(screen.getByText('Bookings made as a guest')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.queryByTestId('claim-card')).toBeNull();
  });

  it('is hidden when there is nothing to claim', async () => {
    countsMock.mockResolvedValue(ok({ events: 0, hotels: 0, apartments: 0, total: 0 }));
    await show();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('claim-card')).toBeNull();
  });

  it.each<[string, ApiError]>([
    ['a gate or desk account (not_customer)', { kind: 'forbidden', code: 'not_customer' }],
    ['a failed check, quietly', { kind: 'network' }],
    ['a server error, quietly', { kind: 'unavailable', status: 503 }],
  ])('is never shown for %s', async (_, e) => {
    countsMock.mockResolvedValue(err(e));
    await show();
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.queryByTestId('claim-card')).toBeNull();
    expect(screen.queryByText(/try again/i)).toBeNull();
  });

  it('asks to confirm the email first when it is unverified', async () => {
    countsMock.mockResolvedValue(err({ kind: 'forbidden', code: 'email_unverified' }));
    await show();
    expect(
      await screen.findByText('To add bookings you made as a guest, confirm your email first.'),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add them' })).toBeNull();
  });

  it('is offered from the empty list too', async () => {
    bookings(false);
    countsMock.mockResolvedValue(ok({ events: 1, hotels: 0, apartments: 0, total: 1 }));
    await show();
    expect(screen.getByText('No bookings yet')).toBeTruthy();
    expect(
      await screen.findByText('1 booking made with a•••a@gmail.com can be added to your account.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add it' })).toBeTruthy();
  });
});

describe('the sheet', () => {
  it('explains with the masked email, sends a code and counts down the resend', async () => {
    const sheet = await openSheet();
    expect(within(sheet).getByText(/We’ll email a 6-digit code to a•••a@gmail\.com/)).toBeTruthy();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Send code' }));
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(await within(sheet).findByText('Enter the 6-digit code')).toBeTruthy();
    expect(within(sheet).getByText('Send a new code in 1:00')).toBeTruthy();
    await act(() => {
      jest.advanceTimersByTime(30_000);
    });
    expect(within(sheet).getByText('Send a new code in 0:30')).toBeTruthy();
    await act(() => {
      jest.advanceTimersByTime(30_000);
    });
    await fireEvent.press(within(sheet).getByText('Send a new code'));
    expect(sendMock).toHaveBeenCalledTimes(2);
  });

  it('a wrong code clears the boxes and says so', async () => {
    claimMock.mockResolvedValue(err({ kind: 'forbidden', code: 'invalid_code' }));
    const sheet = await toCodeStep();
    await fireEvent.changeText(within(sheet).getByTestId('claim-code'), '123456');
    expect(claimMock).toHaveBeenCalledWith({}, '123456');
    expect(await within(sheet).findByText('That code is wrong or has expired')).toBeTruthy();
    expect(within(sheet).getByTestId('claim-code').props.value).toBe('');
  });

  it('a rate-limited send shows a neutral countdown, never a refusal', async () => {
    sendMock.mockResolvedValue(err({ kind: 'rateLimited', retryAfterSec: 120 }));
    const sheet = await openSheet();
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Send code' }));
    expect(
      await within(sheet).findByText('Too many tries. You can try again in 2:00.'),
    ).toBeTruthy();
    const button = within(sheet).getByRole('button', { name: 'Send code in 2:00' });
    expect(button.props.accessibilityState).toMatchObject({ disabled: true });
    await act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(within(sheet).getByText('Too many tries. You can try again in 1:00.')).toBeTruthy();
  });

  it('a rate-limited verify keeps the code and counts down', async () => {
    claimMock.mockResolvedValue(err({ kind: 'rateLimited', retryAfterSec: 90 }));
    const sheet = await toCodeStep();
    await fireEvent.changeText(within(sheet).getByTestId('claim-code'), '123456');
    expect(
      await within(sheet).findByText('Too many tries. You can try again in 1:30.'),
    ).toBeTruthy();
    expect(within(sheet).getByTestId('claim-code').props.value).toBe('123456');
  });

  it('success says how many were added and refreshes bookings (and so the wallet)', async () => {
    const result: ClaimResult = { claimed: COUNTS, booking_ids: null, payments: null };
    claimMock.mockResolvedValue(ok(result));
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const sheet = await toCodeStep();
    await fireEvent.changeText(within(sheet).getByTestId('claim-code'), '654321');
    expect(await within(sheet).findByText('Added 3 bookings')).toBeTruthy();
    expect(spy).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    await fireEvent.press(within(sheet).getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('Added 3 bookings')).toBeNull();
  });
});
