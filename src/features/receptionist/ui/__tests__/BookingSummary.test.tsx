import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { Linking } from 'react-native';

import { viewBooking } from '@/features/receptionist/domain/bookingState';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { BookingSummary } from '@/features/receptionist/ui/BookingSummary';

import { booking, TODAY } from '../../hooks/__tests__/deskTestUtils';

afterEach(() => {
  jest.restoreAllMocks();
});

function renderSummary(b: BookingRow, today = TODAY) {
  return render(<BookingSummary booking={b} view={viewBooking(b, today)} today={today} />);
}

const room: BookingRow['hotel_rooms'] = {
  id: 'r1',
  room_number: 204,
  floor: 2,
  status: 'available',
  room_type_id: 't1',
  hotel_room_types: { name: 'Deluxe' },
};

it('shows the status, name, code, dates, room, guests, payment, phone and requests', async () => {
  const b = booking('b1', {
    guest_name: 'Ada Obi',
    guest_phone: '+234 803 123 4567',
    check_in_code: 'A1B2C3D4',
    adults: 2,
    children: 1,
    special_requests: 'Late arrival',
    hotel_rooms: room,
  });
  await renderSummary(b);
  expect(screen.getByText('Arriving')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  expect(screen.getByText('A1B2C3D4')).toBeTruthy();
  expect(screen.getByText('Sun 11 Oct – Tue 13 Oct, 2 nights')).toBeTruthy();
  expect(screen.getByText('Room 204 · Deluxe · Floor 2')).toBeTruthy();
  expect(screen.getByText('2 adults, 1 child')).toBeTruthy();
  expect(screen.getByText('Paid')).toBeTruthy();
  expect(screen.getByText('Late arrival')).toBeTruthy();
  expect(screen.queryByTestId('banner')).toBeNull();
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  await fireEvent.press(screen.getByRole('link', { name: 'Call +234 803 123 4567' }));
  expect(open).toHaveBeenCalledWith('tel:+2348031234567');
});

it('falls back to Guest, No room yet and No code, and hides empty rows', async () => {
  await renderSummary(booking('b2', { guest_name: null, adults: null, children: null }));
  expect(screen.getByRole('header', { name: 'Guest' })).toBeTruthy();
  expect(screen.getByText('No room yet')).toBeTruthy();
  expect(screen.getByText('No code')).toBeTruthy();
  expect(screen.queryByText('Guests')).toBeNull();
  expect(screen.queryByText('Phone')).toBeNull();
  expect(screen.queryByText('Special requests')).toBeNull();
});

it.each<[BookingRow['payment_status'], string]>([
  ['pending', 'Not paid'],
  [null, 'Not paid'],
  ['refunded', 'Refunded'],
  ['failed', 'Failed'],
])('labels payment %s as "%s" with the unpaid blocker', async (status, label) => {
  await renderSummary(booking('b3', { payment_status: status }));
  // The stage pill also says "Not paid", so the row's value is one of possibly two matches.
  expect(within(screen.getByTestId('status-pill')).getByText('Not paid')).toBeTruthy();
  expect(screen.getAllByText(label).length).toBeGreaterThanOrEqual(1);
  expect(
    screen.getByText(
      "Payment hasn't been completed for this booking. The guest can pay on the Bookhushly app or website.",
    ),
  ).toBeTruthy();
});

it('warns about an early arrival and a room that is not ready', async () => {
  await renderSummary(
    booking('b4', {
      check_in_date: '2026-10-13',
      check_out_date: '2026-10-15',
      hotel_rooms: { ...room, status: 'under_maintenance' },
    }),
  );
  expect(screen.getByText('Early')).toBeTruthy();
  expect(
    screen.getByText('Booked for Tue 13 Oct — 2 days early. You can still check them in.'),
  ).toBeTruthy();
  expect(
    screen.getByText(
      'Room 204 is marked under maintenance. Choose another room or check with housekeeping.',
    ),
  ).toBeTruthy();
});

it('warns about an early check-out for an in-house guest', async () => {
  await renderSummary(
    booking('b5', { booking_status: 'checked_in', checked_in: true, check_out_date: '2026-10-14' }),
  );
  expect(screen.getByText('In house')).toBeTruthy();
  expect(screen.getByText('Booked until Wed 14 Oct — leaving 3 days early.')).toBeTruthy();
});

it('states a cancelled booking and a finished stay', async () => {
  await renderSummary(booking('b6', { booking_status: 'cancelled' }));
  expect(screen.getByText('Cancelled')).toBeTruthy();
  expect(screen.getByText('This booking was cancelled.')).toBeTruthy();
  await renderSummary(
    booking('b7', { booking_status: 'checked_out', checked_out_at: '2026-10-11T09:42:00Z' }),
  );
  expect(screen.getByText('Checked out')).toBeTruthy();
  expect(screen.getByText('This guest checked out at 10:42.')).toBeTruthy();
  await renderSummary(
    booking('b8', { booking_status: 'checked_out', checked_out_at: '2026-10-09T09:42:00Z' }),
  );
  expect(screen.getByText('This guest checked out on Fri 9 Oct at 10:42.')).toBeTruthy();
});
