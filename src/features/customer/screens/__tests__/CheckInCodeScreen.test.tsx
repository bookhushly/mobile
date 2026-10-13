import { render, screen } from '@testing-library/react-native';

import { fromHotel } from '@/features/customer/domain/myBookings';
import { useBooking } from '@/features/customer/hooks/useBooking';
import type { WalletEntry } from '@/features/customer/offline/wallet';
import type { HotelBookingRow } from '@/features/customer/schemas/bookings';
import { CheckInCodeScreen } from '@/features/customer/screens/CheckInCodeScreen';
import { useBrightScreen } from '@/shared/platform/useBrightScreen';
import { usePreventCapture } from '@/shared/platform/usePreventCapture';

import { ho, NOON, TODAY } from '../../hooks/__tests__/customerTestUtils';

jest.mock('@/features/customer/hooks/useBooking', () => ({ useBooking: jest.fn() }));
jest.mock('@/shared/platform/useBrightScreen', () => ({ useBrightScreen: jest.fn() }));
jest.mock('@/shared/platform/usePreventCapture', () => ({ usePreventCapture: jest.fn() }));
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => Date.now() } }));

const mockBooking = jest.mocked(useBooking);
const mockBright = jest.mocked(useBrightScreen);
const mockCapture = jest.mocked(usePreventCapture);
const ID = '0b6f1f4e-2c1a-4f6e-9a39-6f0e7d2b9c11';

function loaded(over: Partial<ReturnType<typeof useBooking>>) {
  mockBooking.mockReturnValue({
    row: undefined,
    fromWallet: null,
    savedAt: null,
    today: TODAY,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    ...over,
  });
}

async function show(id: string | null = ID) {
  await render(<CheckInCodeScreen userId="u1" bookingId={id} onClose={jest.fn()} />);
}

afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers({ now: NOON });
  jest.clearAllMocks();
});

it('shows the hotel, dates, QR and the spaced code, selectable, with the screen bright', async () => {
  loaded({ row: ho({ id: ID }) });
  await show();
  expect(screen.getByText('Harbour Suites')).toBeTruthy();
  expect(screen.getByText('13–15 Oct · check-in from 2:00 pm')).toBeTruthy();
  expect(screen.getByLabelText('Check-in code')).toBeTruthy();
  const code = screen.getByText('AB12 CD34');
  expect(code.props.selectable).toBe(true);
  expect(screen.getByText('Show this at the front desk')).toBeTruthy();
  expect(screen.queryByText('Checked in')).toBeNull();
  expect(screen.getByLabelText('Code A B 1 2 C D 3 4')).toBeTruthy();
  expect(mockBright).toHaveBeenLastCalledWith(true);
  expect(mockCapture).toHaveBeenCalledWith('checkin-code');
});

it('a checked-in stay still shows its code, with a Checked in chip', async () => {
  loaded({ row: ho({ id: ID, booking_status: 'checked_in', checked_in: true }) });
  await show();
  expect(screen.getByText('Checked in')).toBeTruthy();
  expect(screen.getByText('AB12 CD34')).toBeTruthy();
});

it.each<[string, Partial<HotelBookingRow>]>([
  ['unpaid', { payment_status: 'pending' }],
  ['cancelled', { booking_status: 'cancelled' }],
  ['checked out', { booking_status: 'checked_out' }],
  ['no code', { check_in_code: null }],
  ['blank code', { check_in_code: '  ' }],
])('%s: no check-in code, and the screen stays as it is', async (_, over) => {
  loaded({ row: ho({ id: ID, ...over }) });
  await show();
  expect(screen.getByText('No check-in code for this booking')).toBeTruthy();
  expect(screen.queryByLabelText('Check-in code')).toBeNull();
  expect(mockBright).not.toHaveBeenCalledWith(true);
  expect(mockBright).toHaveBeenLastCalledWith(false);
});

it('loading keeps the screen as it is', async () => {
  loaded({});
  await show();
  expect(screen.getByLabelText('Loading')).toBeTruthy();
  expect(mockBright).toHaveBeenLastCalledWith(false);
});

it('offline: the saved code with a note', async () => {
  const entry: WalletEntry = { ...fromHotel(ho({ id: ID }), TODAY), checkInCode: 'AB12CD34' };
  loaded({ fromWallet: entry, savedAt: Date.parse('2026-10-13T09:42:00Z') });
  await show();
  expect(screen.getByText('Showing your saved code — last updated 10:42.')).toBeTruthy();
  expect(screen.getByText('AB12 CD34')).toBeTruthy();
  expect(mockBright).toHaveBeenLastCalledWith(true);
});

it('offline without a saved code says there is none', async () => {
  loaded({ fromWallet: fromHotel(ho({ id: ID }), TODAY) });
  await show();
  expect(screen.getByText('No check-in code for this booking')).toBeTruthy();
});

it('not yours, failed and bad ids', async () => {
  loaded({ row: null });
  await show();
  expect(screen.getByText("This booking isn't on your account")).toBeTruthy();
  loaded({ error: true });
  await show();
  expect(screen.getByText("Couldn't load your check-in code")).toBeTruthy();
  mockBooking.mockClear();
  await show(null);
  expect(screen.getByText("This booking isn't on your account")).toBeTruthy();
  expect(mockBooking).not.toHaveBeenCalled();
  expect(mockBright).not.toHaveBeenCalledWith(true);
});
