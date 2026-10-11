import { fireEvent, render, screen } from '@testing-library/react-native';
import type { ComponentProps } from 'react';

import { DeskProvider } from '@/features/receptionist/hooks/DeskContext';
import { useBooking } from '@/features/receptionist/hooks/useBooking';
import { BookingScreen } from '@/features/receptionist/screens/BookingScreen';

import { booking, desk, TODAY } from '../../hooks/__tests__/deskTestUtils';

// A factory, not an automock: the real module loads supabase → native storage.
jest.mock('@/features/receptionist/hooks/useBooking', () => ({ useBooking: jest.fn() }));

const mockBooking = jest.mocked(useBooking);

function loaded(b: ReturnType<typeof booking> | null | undefined, error = false) {
  const refetch = jest.fn();
  mockBooking.mockReturnValue({ booking: b, error, refetch });
  return refetch;
}

function renderBooking(
  props: Partial<ComponentProps<typeof BookingScreen>> = {},
  openCheckIn = jest.fn(),
) {
  return render(
    <DeskProvider value={{ ...desk, openCheckIn }}>
      <BookingScreen id="b1" onBack={jest.fn()} {...props} />
    </DeskProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

it('shows the booking and Check in opens the sheet with its code', async () => {
  loaded(booking('b1', { guest_name: 'Ada Obi', check_in_code: 'A1B2C3D4' }));
  const openCheckIn = jest.fn();
  await renderBooking({}, openCheckIn);
  expect(mockBooking).toHaveBeenCalledWith('b1');
  expect(screen.getByRole('header', { name: 'Booking' })).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(openCheckIn).toHaveBeenCalledWith('A1B2C3D4');
  // Not wired yet (Tasks 13/14): no half-working buttons.
  expect(screen.queryByRole('button', { name: 'Choose another room' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Check out' })).toBeNull();
});

it('offers Choose another room only when a handler is supplied, for an arriving guest', async () => {
  const b = booking('b1');
  loaded(b);
  const onChooseRoom = jest.fn();
  await renderBooking({ onChooseRoom });
  await fireEvent.press(screen.getByRole('button', { name: 'Choose another room' }));
  expect(onChooseRoom).toHaveBeenCalledWith(b);
  expect(screen.queryByRole('button', { name: 'Check out' })).toBeNull();
});

it('offers Check out only when a handler is supplied, for an in-house guest', async () => {
  const b = booking('b1', { booking_status: 'checked_in', checked_in: true });
  loaded(b);
  const onCheckOut = jest.fn();
  await renderBooking({ onCheckOut, onChooseRoom: jest.fn() });
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  expect(onCheckOut).toHaveBeenCalledWith(b);
  expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Choose another room' })).toBeNull();
});

it('offers no action for a cancelled booking', async () => {
  loaded(booking('b1', { booking_status: 'cancelled' }));
  await renderBooking({ onCheckOut: jest.fn(), onChooseRoom: jest.fn() });
  expect(screen.getByText('This booking was cancelled.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: /Check in|Check out|Choose another room/ })).toBeNull();
});

it('says when the booking is not at this hotel', async () => {
  loaded(null);
  await renderBooking();
  expect(screen.getByText("This booking isn't at Eko Suites")).toBeTruthy();
});

it('shows skeletons while loading and Try again on a failed load', async () => {
  loaded(undefined);
  await renderBooking();
  expect(screen.getByLabelText('Loading')).toBeTruthy();
  const refetch = loaded(undefined, true);
  await renderBooking();
  expect(screen.getByText("Couldn't load this booking")).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('Back calls the route', async () => {
  loaded(booking('b1', { check_in_date: TODAY }));
  const onBack = jest.fn();
  await renderBooking({ onBack });
  await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});
