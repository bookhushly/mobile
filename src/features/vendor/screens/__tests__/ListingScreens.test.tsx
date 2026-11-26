import { fireEvent, render, screen } from '@testing-library/react-native';

import {
  sampleBookings,
  sampleCalendar,
  sampleEvents,
  sampleMoveBooking,
  sampleToggleBlocked,
} from '@/features/vendor/api/sampleListings';
import type { ListingBooking } from '@/features/vendor/domain/listings';
import { ApartmentTodayScreen } from '@/features/vendor/screens/ApartmentTodayScreen';
import { BookingScreen } from '@/features/vendor/screens/BookingScreen';
import { BookingsScreen } from '@/features/vendor/screens/BookingsScreen';
import { CalendarScreen } from '@/features/vendor/screens/CalendarScreen';
import { EventTodayScreen } from '@/features/vendor/screens/EventTodayScreen';
import { HotelTodayScreen } from '@/features/vendor/screens/HotelTodayScreen';

const NOW = Date.parse('2026-11-29T07:20:00Z');
const TODAY = '2026-11-29';
const noop = () => undefined;
const top = (kindWord: string) => ({ businessName: 'Biz', kindWord, today: TODAY, nowMs: NOW });
const ready = <T,>(data: T) => ({
  status: 'ready' as const,
  data,
  refreshing: false,
  refresh: noop,
});
const find = (kind: 'hotel' | 'apartment', id: string): ListingBooking => {
  const b = sampleBookings(kind, NOW).find((x) => x.id === id);
  if (b === undefined) throw new Error('sample missing');
  return b;
};

describe('HotelTodayScreen', () => {
  it('arrivals and departures, then guests still to arrive with how they pay', async () => {
    await render(
      <HotelTodayScreen
        top={top('Hotel')}
        state={ready(sampleBookings('hotel', NOW))}
        onCheckIn={noop}
        onOpenBookings={noop}
        onOpenBooking={noop}
      />,
    );
    expect(screen.getByTestId('vendor-headline')).toHaveTextContent('4 arriving today,\n2 leaving');
    expect(
      screen.getByRole('button', { name: 'Arriving today, 4. 1 already checked in' }),
    ).toBeTruthy();
    expect(screen.getByText('Funmi Bello')).toBeTruthy();
    expect(screen.getByText('Pay at hotel')).toBeTruthy();
    expect(screen.getByTestId('vendor-check-in')).toBeTruthy();
  });
  it('without the front desk, says who checks guests in', async () => {
    await render(
      <HotelTodayScreen
        top={top('Hotel')}
        state={ready(sampleBookings('hotel', NOW))}
        onCheckIn={null}
        onOpenBookings={noop}
        onOpenBooking={noop}
      />,
    );
    expect(screen.queryByTestId('vendor-check-in')).toBeNull();
    expect(
      screen.getByText('Your front-desk staff check guests in from their Bookhushly app.'),
    ).toBeTruthy();
  });
});

describe('ApartmentTodayScreen', () => {
  it('the booking waiting for an answer leads; Confirm is one tap', async () => {
    const onAnswer = jest.fn();
    await render(
      <ApartmentTodayScreen
        top={top('Serviced apartments')}
        state={ready(sampleBookings('apartment', NOW))}
        busyId={null}
        problem={null}
        onAnswer={onAnswer}
        onOpenBookings={noop}
      />,
    );
    expect(screen.getByTestId('vendor-headline')).toHaveTextContent(
      '2 bookings to confirm,\n1 check-in today',
    );
    await fireEvent.press(screen.getByTestId('vendor-confirm'));
    expect(onAnswer).toHaveBeenCalledWith(expect.objectContaining({ id: 'a1' }), true);
  });
});

describe('EventTodayScreen', () => {
  it('the next event: sold against capacity and by ticket type, then Scan tickets', async () => {
    const onScan = jest.fn();
    await render(
      <EventTodayScreen
        top={top('Events')}
        state={ready(sampleEvents(NOW))}
        onScan={onScan}
        onOpenEvents={noop}
      />,
    );
    expect(screen.getByTestId('vendor-headline')).toHaveTextContent(
      'Lagos Jazz Night\nis in 2 days',
    );
    expect(screen.getByText('312 of 400 sold')).toBeTruthy();
    expect(screen.getByLabelText('78 percent sold')).toBeTruthy();
    expect(screen.getByText('72 / 100')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-scan'));
    expect(onScan).toHaveBeenCalled();
  });
});

describe('BookingsScreen and BookingScreen', () => {
  it('apartments open on To confirm', async () => {
    await render(
      <BookingsScreen
        kind="apartment"
        today={TODAY}
        tab="toConfirm"
        onTab={noop}
        onOpen={noop}
        state={{
          status: 'ready',
          bookings: sampleBookings('apartment', NOW),
          refreshing: false,
          refresh: noop,
        }}
      />,
    );
    expect(screen.getByText('Tolu Adeyemi')).toBeTruthy();
    expect(screen.getAllByText('Waiting for you to confirm').length).toBeGreaterThan(0);
  });

  it('after cancelling a paid stay, says where the guest’s refund is', async () => {
    await render(
      <BookingScreen
        busy={false}
        problem={null}
        onBack={noop}
        onFrontDesk={null}
        onMove={noop}
        state={{
          status: 'ready',
          booking: { ...find('apartment', 'a3'), status: 'cancelled', refund: 'beingFinished' },
        }}
      />,
    );
    expect(screen.getByTestId('vendor-booking-refund')).toHaveTextContent(
      /Bookhushly has been alerted and will finish it/,
    );
  });

  it('a pending apartment booking: confirm, or decline after a warning that tells the truth', async () => {
    const onMove = jest.fn();
    await render(
      <BookingScreen
        busy={false}
        problem={null}
        onBack={noop}
        onFrontDesk={null}
        onMove={onMove}
        state={{ status: 'ready', booking: find('apartment', 'a1') }}
      />,
    );
    await fireEvent.press(screen.getByTestId('vendor-booking-forward'));
    expect(onMove).toHaveBeenCalledWith('pending', 'confirmed');
    await fireEvent.press(screen.getByTestId('vendor-booking-cancel'));
    expect(screen.getByText(/is told, and refunded ₦240,000 to how they paid/)).toBeTruthy();
    await fireEvent.press(screen.getByTestId('vendor-booking-cancel-confirm'));
    expect(onMove).toHaveBeenCalledWith('pending', 'cancelled');
  });

  it('a hotel stay checks in at the front desk, not here', async () => {
    await render(
      <BookingScreen
        busy={false}
        problem={null}
        onBack={noop}
        onFrontDesk={null}
        onMove={noop}
        state={{ status: 'ready', booking: find('hotel', 'h1') }}
      />,
    );
    expect(screen.queryByTestId('vendor-booking-forward')).toBeNull();
  });
});

describe('CalendarScreen', () => {
  it('booked nights cannot be blocked; a free night toggles', async () => {
    const onToggle = jest.fn();
    await render(
      <CalendarScreen
        today={TODAY}
        month="2026-12-01"
        onMonth={noop}
        busyDate={null}
        problem={null}
        onToggle={onToggle}
        state={{ status: 'ready', booked: ['2026-12-05'], blocked: ['2026-12-10'] }}
      />,
    );
    expect(screen.getByLabelText('Saturday 5 December, booked')).toBeDisabled();
    expect(screen.getByLabelText('Thursday 10 December, blocked')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Monday 14 December, free'));
    expect(onToggle).toHaveBeenCalledWith('2026-12-14');
  });
});

describe('sample listings (stand in for the web routes)', () => {
  it('a move must start from the status you saw', () => {
    expect(sampleMoveBooking('apartment', 'a2', 'confirmed', 'checked_in', NOW)).toMatchObject({
      ok: false,
      error: { code: 'stale_status' },
    });
    expect(sampleMoveBooking('apartment', 'a2', 'pending', 'confirmed', NOW).ok).toBe(true);
  });
  it('a booked night can’t be blocked', () => {
    const booked = sampleCalendar(NOW).booked[0];
    if (booked === undefined) throw new Error('no booked night');
    expect(sampleToggleBlocked(booked, NOW)).toMatchObject({
      ok: false,
      error: { code: 'date_booked' },
    });
  });
});
