import { fireEvent, render, screen } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';
import type { ComponentProps } from 'react';

import {
  fromApartment,
  fromEvent,
  fromHotel,
  splitBookings,
} from '@/features/customer/domain/myBookings';
import { useMyBookings, type BookingRows } from '@/features/customer/hooks/useMyBookings';
import { useNotifications } from '@/features/customer/hooks/useNotifications';
import type { WalletEntry } from '@/features/customer/offline/wallet';
import { BookingsScreen } from '@/features/customer/screens/BookingsScreen';

import { ap, ev, ho, TODAY } from '../../hooks/__tests__/customerTestUtils';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/customer/hooks/useMyBookings', () => ({ useMyBookings: jest.fn() }));
jest.mock('@/features/customer/hooks/useNotifications', () => ({ useNotifications: jest.fn() }));
jest.mock('@/shared/api/instance', () => ({ clock: { serverNow: () => mockNow } }));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'opened' })),
}));
const mockNow = Date.parse('2026-10-13T11:00:00Z');

const mockMy = jest.mocked(useMyBookings);
const mockNotes = jest.mocked(useNotifications);

type My = ReturnType<typeof useMyBookings>;

function ready(rows: BookingRows, over: Partial<My> = {}): My {
  const all = [
    ...rows.events.map((r) => fromEvent(r, TODAY)),
    ...rows.hotels.map((r) => fromHotel(r, TODAY)),
    ...rows.apartments.map((r) => fromApartment(r, TODAY)),
  ];
  const my: My = {
    bookings: splitBookings(all),
    rows,
    saved: null,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    ...over,
  };
  mockMy.mockReturnValue(my);
  return my;
}

function unread(n: number) {
  mockNotes.mockReturnValue({
    items: [],
    unread: n,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    open: jest.fn(),
    markUnread: jest.fn(),
    markAllRead: jest.fn(),
    undoMarkAll: jest.fn(),
    remove: jest.fn(),
    writeError: null,
    clearWriteError: jest.fn(),
  });
}

const tonight = ev({
  id: 'e-today',
  listing: {
    id: 'l2',
    title: 'Jazz at the lagoon',
    location: 'Lagos',
    media_urls: [],
    event_date: `${TODAY}T00:00:00`,
    event_end_date: null,
    event_time: `${TODAY}T18:00:00+00:00`,
    require_dynamic_ticket: true,
  },
});
const upcoming = ev();
const stayToday = ho();
const pastHidden = ap();
const unpaidToday = ap({
  id: 'a-today',
  check_in_date: TODAY,
  check_out_date: '2026-10-15',
  payment_status: 'pending',
  booking_status: 'pending',
});

type Props = ComponentProps<typeof BookingsScreen>;
function handlers(): Omit<Props, 'userId'> {
  return {
    onOpenBooking: jest.fn(),
    onShowTickets: jest.fn(),
    onShowCheckInCode: jest.fn(),
    onOpenNotifications: jest.fn(),
  };
}

// Fake timers: FlatList's cell-batching timer otherwise fires between act() scopes.
afterEach(() => {
  jest.useRealTimers();
});
beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  unread(0);
});

it('splits upcoming and past with counts, and a row opens its booking', async () => {
  ready({ events: [upcoming], hotels: [], apartments: [pastHidden] });
  const h = handlers();
  await render(<BookingsScreen userId="u1" {...h} />);
  expect(screen.getByRole('tab', { name: 'Upcoming (1)', selected: true })).toBeTruthy();
  expect(screen.getByText('Afrobeats night')).toBeTruthy();
  expect(screen.getByText('Event · Tue 20 Oct · 7:00 pm')).toBeTruthy();
  expect(screen.getByText('Confirmed')).toBeTruthy();

  await fireEvent.press(screen.getByRole('tab', { name: 'Past (1)' }));
  expect(screen.queryByText('Afrobeats night')).toBeNull();
  // C4: a hidden listing lists as its kind word, with its dates and status.
  const row = screen.getByRole('button', { name: /^Apartment stay, Thu 1 Oct/ });
  expect(screen.getByText("Details aren't available right now")).toBeTruthy();
  expect(screen.getByText('Checked out')).toBeTruthy();
  await fireEvent.press(row);
  expect(h.onOpenBooking).toHaveBeenCalledWith('apartment', 'a1');
});

it('leads with Today cards whose main action fits the booking', async () => {
  ready({ events: [tonight, upcoming], hotels: [stayToday], apartments: [unpaidToday] });
  const h = handlers();
  await render(<BookingsScreen userId="u1" {...h} />);
  expect(screen.getByRole('tab', { name: 'Upcoming (1)' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Show tickets, Jazz at the lagoon' }));
  expect(h.onShowTickets).toHaveBeenCalledWith('e-today');
  await fireEvent.press(screen.getByRole('button', { name: 'Show check-in code, Harbour Suites' }));
  expect(h.onShowCheckInCode).toHaveBeenCalledWith('h1');
  await fireEvent.press(screen.getByRole('button', { name: 'Open, Apartment stay' }));
  expect(h.onOpenBooking).toHaveBeenCalledWith('apartment', 'a-today');
  await fireEvent.press(screen.getByRole('button', { name: 'Booking details, Harbour Suites' }));
  expect(h.onOpenBooking).toHaveBeenCalledWith('hotel', 'h1');
});

it('saved bookings say so, and a saved ticket still shows from the Today card', async () => {
  const b = fromEvent(tonight, TODAY);
  const entry: WalletEntry = {
    ...b,
    tickets: [{ id: 't1', index: 1, total: 1, type: 'Regular', seat: null, admittedAt: null }],
    liveOnly: true,
  };
  mockMy.mockReturnValue({
    bookings: { today: [entry], upcoming: [], past: [] },
    rows: null,
    saved: { savedAt: Date.parse('2026-10-13T09:42:00Z') },
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
  });
  const h = handlers();
  await render(<BookingsScreen userId="u1" {...h} />);
  expect(
    screen.getByText('Showing saved bookings — last updated 10:42. Pull to refresh.'),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Show tickets, Jazz at the lagoon' }));
  expect(h.onShowTickets).toHaveBeenCalledWith('e-today');
});

it('with no bookings at all, explains and offers the website', async () => {
  ready({ events: [], hotels: [], apartments: [] });
  await render(<BookingsScreen userId="u1" {...handlers()} />);
  expect(screen.getByText('No bookings yet')).toBeTruthy();
  expect(
    screen.getByText('Bookings you make while signed in with this email show up here.'),
  ).toBeTruthy();
  expect(screen.getByText(/^Booked as a guest before you had an account\?/)).toBeTruthy();
  expect(screen.queryByRole('tab')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Browse on bookhushly.com' }));
  expect(openBrowserAsync).toHaveBeenCalledWith('https://bookhushly.com');
});

it('with only past bookings, upcoming says none', async () => {
  ready({ events: [], hotels: [], apartments: [pastHidden] });
  await render(<BookingsScreen userId="u1" {...handlers()} />);
  expect(screen.getByText('No upcoming bookings')).toBeTruthy();
  expect(screen.queryByText('No bookings yet')).toBeNull();
});

it('shows skeletons, then an error with Try again when nothing loaded and nothing saved', async () => {
  const refetch = jest.fn(() => Promise.resolve());
  const base = { rows: null, saved: null, bookings: null, refetch };
  mockMy.mockReturnValue({ ...base, loading: true, error: false });
  await render(<BookingsScreen userId="u1" {...handlers()} />);
  expect(screen.getByLabelText('Loading')).toBeTruthy();
  mockMy.mockReturnValue({ ...base, loading: false, error: true });
  await render(<BookingsScreen userId="u1" {...handlers()} />);
  expect(screen.getByText("Couldn't load your bookings")).toBeTruthy();
  expect(screen.queryByText('No bookings yet')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('the bell says how many are unread and opens notifications', async () => {
  ready({ events: [upcoming], hotels: [], apartments: [] });
  const h = handlers();
  await render(<BookingsScreen userId="u1" {...h} />);
  expect(screen.getByRole('button', { name: 'Notifications' })).toBeTruthy();
  unread(3);
  await render(<BookingsScreen userId="u1" {...h} />);
  await fireEvent.press(screen.getByRole('button', { name: 'Notifications, 3 unread' }));
  expect(h.onOpenNotifications).toHaveBeenCalledTimes(1);
});
