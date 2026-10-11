import { fireEvent, render, screen } from '@testing-library/react-native';

import { splitGuests } from '@/features/receptionist/domain/guestLists';
import { DeskProvider } from '@/features/receptionist/hooks/DeskContext';
import { useFreshness } from '@/features/receptionist/hooks/useFreshness';
import { useGuests } from '@/features/receptionist/hooks/useGuests';
import { useRooms } from '@/features/receptionist/hooks/useRooms';
import type { BookingRow, RoomRow } from '@/features/receptionist/schemas/desk';
import { TodayScreen } from '@/features/receptionist/screens/TodayScreen';

import { booking, desk, TODAY } from '../../hooks/__tests__/deskTestUtils';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/receptionist/hooks/useGuests', () => ({ useGuests: jest.fn() }));
jest.mock('@/features/receptionist/hooks/useRooms', () => ({ useRooms: jest.fn() }));
jest.mock('@/features/receptionist/hooks/useFreshness', () => ({ useFreshness: jest.fn() }));

const mockGuests = jest.mocked(useGuests);
const mockRooms = jest.mocked(useRooms);
const mockFreshness = jest.mocked(useFreshness);

const room = (n: number, status: RoomRow['status']): RoomRow => ({
  id: `r${String(n)}`,
  room_number: n,
  floor: 1,
  status,
  room_type_id: null,
  last_cleaned_at: null,
  hotel_room_types: null,
});

function guestsReady(rows: BookingRow[], over: Partial<ReturnType<typeof useGuests>> = {}) {
  mockGuests.mockReturnValue({
    lists: splitGuests(rows, TODAY),
    rows,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    updatedAt: 1,
    ...over,
  });
}

const nav = {
  onOpenGuests: jest.fn(),
  onOpenFreeRooms: jest.fn(),
  onOpenBooking: jest.fn(),
};

beforeEach(() => {
  jest.clearAllMocks();
  mockFreshness.mockReturnValue(null);
  mockRooms.mockReturnValue({
    rooms: [room(101, 'available'), room(102, 'occupied'), room(103, 'available')],
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    updatedAt: 1,
  });
});

const inHouse = (id: string, out = '2026-10-13') =>
  booking(id, { booking_status: 'checked_in', checked_in: true, check_out_date: out });

function renderToday(openCheckIn = jest.fn()) {
  return render(
    <DeskProvider value={{ ...desk, openCheckIn }}>
      <TodayScreen {...nav} />
    </DeskProvider>,
  );
}

it('shows the hotel, the day, the four counts, and opens each list', async () => {
  guestsReady([
    booking('a', { guest_name: 'Ada Obi' }),
    booking('b'),
    inHouse('c'),
    inHouse('d', TODAY),
  ]);
  await renderToday();
  expect(screen.getByRole('header', { name: 'Eko Suites' })).toBeTruthy();
  expect(screen.getByText('Sunday 11 October')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Arriving, 2' }));
  expect(nav.onOpenGuests).toHaveBeenLastCalledWith('arriving');
  await fireEvent.press(screen.getByRole('button', { name: 'In house, 2' }));
  expect(nav.onOpenGuests).toHaveBeenLastCalledWith('inHouse');
  await fireEvent.press(screen.getByRole('button', { name: 'Leaving, 1' }));
  expect(nav.onOpenGuests).toHaveBeenLastCalledWith('leaving');
  await fireEvent.press(screen.getByRole('button', { name: 'Free rooms, 2' }));
  expect(nav.onOpenFreeRooms).toHaveBeenCalledTimes(1);
  // Arrivals list: a row opens the booking, in-house guests are not listed here.
  await fireEvent.press(screen.getByRole('button', { name: /^Ada Obi, No room yet/ }));
  expect(nav.onOpenBooking).toHaveBeenCalledWith('a');
  expect(screen.getByRole('header', { name: 'Arriving today (2)' })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /See all/ })).toBeNull();
});

it('Check in a guest opens the check-in sheet without a code', async () => {
  guestsReady([booking('a')]);
  const openCheckIn = jest.fn();
  await renderToday(openCheckIn);
  await fireEvent.press(screen.getByRole('button', { name: 'Check in a guest' }));
  expect(openCheckIn).toHaveBeenCalledTimes(1);
  expect(openCheckIn).toHaveBeenCalledWith();
});

it('says when there are no more arrivals', async () => {
  guestsReady([inHouse('c')]);
  await renderToday();
  expect(screen.getByText('No more arrivals today')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Arriving, 0' })).toBeTruthy();
});

it('lists the first 8 arrivals and offers See all for the rest', async () => {
  guestsReady(Array.from({ length: 10 }, (_, i) => booking(`g${String(i)}`)));
  await renderToday();
  expect(screen.getAllByRole('button', { name: /^Guest g\d/ })).toHaveLength(8);
  await fireEvent.press(screen.getByRole('link', { name: 'See all 10 arriving' }));
  expect(nav.onOpenGuests).toHaveBeenCalledWith('arriving');
});

it('shows the freshness line when the data is stale', async () => {
  guestsReady([booking('a')]);
  mockFreshness.mockReturnValue('Updated 3 min ago');
  await renderToday();
  expect(screen.getByText('Updated 3 min ago')).toBeTruthy();
});

it('shows a dash for free rooms when the room board failed, keeping the guest counts', async () => {
  guestsReady([booking('a')]);
  mockRooms.mockReturnValue({
    rooms: [],
    loading: false,
    error: true,
    refetch: jest.fn(() => Promise.resolve()),
    updatedAt: 0,
  });
  await renderToday();
  expect(screen.getByRole('button', { name: 'Free rooms, not loaded' })).toBeTruthy();
  expect(screen.getByText('—')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Arriving, 1' })).toBeTruthy();
});

it('shows skeletons on first load', async () => {
  mockGuests.mockReturnValue({
    lists: null,
    rows: [],
    loading: true,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    updatedAt: 0,
  });
  await renderToday();
  expect(screen.getByLabelText('Loading')).toBeTruthy();
  // A check-in needs no list: the button is there while loading and on error.
  expect(screen.getByRole('button', { name: 'Check in a guest' })).toBeTruthy();
});

it('shows an error with Try again when nothing could be loaded', async () => {
  const refetch = jest.fn(() => Promise.resolve());
  mockGuests.mockReturnValue({
    lists: null,
    rows: [],
    loading: false,
    error: true,
    refetch,
    updatedAt: 0,
  });
  await renderToday();
  expect(screen.getByText("Couldn't load today")).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Check in a guest' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});
