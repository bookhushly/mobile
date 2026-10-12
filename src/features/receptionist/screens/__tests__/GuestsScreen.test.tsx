import { fireEvent, render, screen, within } from '@testing-library/react-native';
import { useState, type ComponentProps } from 'react';

import { splitGuests, type GuestTab } from '@/features/receptionist/domain/guestLists';
import { DeskProvider, type Desk } from '@/features/receptionist/hooks/DeskContext';
import { useFreshness } from '@/features/receptionist/hooks/useFreshness';
import { useGuests } from '@/features/receptionist/hooks/useGuests';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { GuestsScreen } from '@/features/receptionist/screens/GuestsScreen';
import { useWide } from '@/shared/ui/useWide';

import { booking, desk, TODAY } from '../../hooks/__tests__/deskTestUtils';

// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/receptionist/hooks/useGuests', () => ({ useGuests: jest.fn() }));
jest.mock('@/features/receptionist/hooks/useFreshness', () => ({ useFreshness: jest.fn() }));
jest.mock('@/shared/ui/useWide', () => ({ useWide: jest.fn() }));

const mockGuests = jest.mocked(useGuests);
const mockFreshness = jest.mocked(useFreshness);
const mockWide = jest.mocked(useWide);

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

const room = (n: number, type: string | null = 'Deluxe'): BookingRow['hotel_rooms'] => ({
  id: `r${String(n)}`,
  room_number: n,
  floor: 1,
  status: 'occupied',
  room_type_id: null,
  hotel_room_types: type === null ? null : { name: type },
});

const rows: BookingRow[] = [
  booking('a', { guest_name: 'Ada Obi', guest_phone: '+2348031234567', check_in_code: 'A1B2C3D4' }),
  booking('b', { guest_name: 'Bola Ade' }),
  booking('c', {
    guest_name: 'Chidi Eze',
    booking_status: 'checked_in',
    checked_in: true,
    hotel_rooms: room(204),
  }),
  booking('d', {
    guest_name: 'Dayo Ola',
    booking_status: 'checked_in',
    checked_in: true,
    check_out_date: TODAY,
    hotel_rooms: room(305),
  }),
];

type Props = Partial<ComponentProps<typeof GuestsScreen>>;

// The route owns the tab param; the test stands in for it.
function Harness(props: Props & { initialTab?: GuestTab; deskOver?: Partial<Desk> }) {
  const { initialTab = 'arriving', deskOver, onTabChange, ...rest } = props;
  const [tab, setTab] = useState<GuestTab>(initialTab);
  return (
    <DeskProvider value={{ ...desk, ...deskOver }}>
      <GuestsScreen
        tab={tab}
        onTabChange={(t) => {
          setTab(t);
          onTabChange?.(t);
        }}
        onOpenBooking={jest.fn()}
        {...rest}
      />
    </DeskProvider>
  );
}

// Fake timers (as in RoomsScreen.test): FlatList's 50 ms cell-batching timer otherwise fires
// between act() scopes on a loaded machine (an intermittent "not wrapped in act" warning).
afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockWide.mockReturnValue(false);
  mockFreshness.mockReturnValue(null);
});

it('switches tabs with the counts in the labels and opens a row', async () => {
  guestsReady(rows);
  const onOpenBooking = jest.fn();
  const onTabChange = jest.fn();
  await render(<Harness onOpenBooking={onOpenBooking} onTabChange={onTabChange} />);
  expect(screen.getByRole('tab', { name: 'Arriving (2)' })).toBeTruthy();
  expect(
    screen.getByRole('button', {
      name: /^Ada Obi, No room yet, 11–13 Oct · 2 nights · •••• 4567, Arriving$/,
    }),
  ).toBeTruthy();
  // Phones never mark a row selected.
  expect(screen.queryByRole('button', { name: /^Ada Obi/, selected: true })).toBeNull();
  expect(screen.queryByText('Chidi Eze')).toBeNull();
  // The full phone never appears in a row (R19).
  expect(screen.queryByText(/2348031234567/)).toBeNull();

  await fireEvent.press(screen.getByRole('tab', { name: 'In house (2)' }));
  expect(onTabChange).toHaveBeenCalledWith('inHouse');
  expect(screen.getByText('Chidi Eze')).toBeTruthy();
  expect(screen.getByText('Room 204 · Deluxe')).toBeTruthy();
  expect(screen.getByText('Due out')).toBeTruthy();

  await fireEvent.press(screen.getByRole('tab', { name: 'Leaving (1)' }));
  expect(screen.queryByText('Chidi Eze')).toBeNull();
  await fireEvent.press(screen.getByRole('button', { name: /^Dayo Ola/ }));
  expect(onOpenBooking).toHaveBeenCalledWith('d');
});

it('narrows the list by search and says when nothing matches', async () => {
  guestsReady(rows);
  await render(<Harness />);
  await fireEvent.changeText(screen.getByLabelText('Search guests'), 'bola');
  expect(screen.getByText('Bola Ade')).toBeTruthy();
  expect(screen.queryByText('Ada Obi')).toBeNull();
  await fireEvent.changeText(screen.getByLabelText('Search guests'), 'zzz');
  expect(screen.getByText('No guest matches “zzz”')).toBeTruthy();
});

it.each<[GuestTab, string]>([
  ['arriving', 'No arrivals left today'],
  ['inHouse', 'No guests checked in'],
  ['leaving', 'Nobody is due out today'],
])('has an empty state for the %s tab', async (tab, text) => {
  guestsReady([]);
  await render(<Harness initialTab={tab} />);
  expect(screen.getByText(text)).toBeTruthy();
  expect(screen.getByRole('tab', { name: /\(0\)$/, selected: true })).toBeTruthy();
});

it('Check in a guest and Account sit in the header', async () => {
  guestsReady(rows);
  const openCheckIn = jest.fn();
  const openAccount = jest.fn();
  await render(
    <DeskProvider value={{ ...desk, openCheckIn, openAccount }}>
      <GuestsScreen tab="arriving" onTabChange={jest.fn()} onOpenBooking={jest.fn()} />
    </DeskProvider>,
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Check in a guest' }));
  expect(openCheckIn).toHaveBeenCalledWith();
  await fireEvent.press(screen.getByRole('button', { name: 'Account' }));
  expect(openAccount).toHaveBeenCalledTimes(1);
});

it('shows skeletons, then an error with Try again when nothing loaded', async () => {
  mockGuests.mockReturnValue({
    lists: null,
    rows: [],
    loading: true,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    updatedAt: 0,
  });
  await render(<Harness />);
  expect(screen.getByLabelText('Loading')).toBeTruthy();
  const refetch = jest.fn(() => Promise.resolve());
  mockGuests.mockReturnValue({
    lists: null,
    rows: [],
    loading: false,
    error: true,
    refetch,
    updatedAt: 0,
  });
  await render(<Harness />);
  expect(screen.getByText("Couldn't load guests")).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('on a tablet, a row opens in the right pane instead of pushing', async () => {
  mockWide.mockReturnValue(true);
  guestsReady(rows);
  const onOpenBooking = jest.fn();
  const openCheckIn = jest.fn();
  await render(<Harness onOpenBooking={onOpenBooking} deskOver={{ openCheckIn }} />);
  expect(screen.getByText('Choose a guest')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: /^Ada Obi/ }));
  expect(onOpenBooking).not.toHaveBeenCalled();
  expect(screen.queryByText('Choose a guest')).toBeNull();
  expect(screen.getByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  expect(screen.getByText('A1B2C3D4')).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Ada Obi/, selected: true })).toBeTruthy();
  expect(screen.getByRole('button', { name: /^Bola Ade/, selected: false })).toBeTruthy();
  // The summary scrolls; the actions are pinned outside the scroll content.
  const pane = within(screen.getByTestId('guest-detail-pane'));
  expect(within(pane.getByTestId('booking-detail-scroll')).getByText('A1B2C3D4')).toBeTruthy();
  expect(
    within(pane.getByTestId('booking-detail-scroll')).queryByRole('button', { name: 'Check in' }),
  ).toBeNull();
  await fireEvent.press(pane.getByRole('button', { name: 'Check in' }));
  expect(openCheckIn).toHaveBeenCalledWith('A1B2C3D4');
});

it('on a tablet, changing tab closes the open detail', async () => {
  mockWide.mockReturnValue(true);
  guestsReady(rows);
  await render(<Harness />);
  await fireEvent.press(screen.getByRole('button', { name: /^Ada Obi/ }));
  expect(screen.getByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  await fireEvent.press(screen.getByRole('tab', { name: 'In house (2)' }));
  expect(screen.queryByRole('header', { name: 'Ada Obi' })).toBeNull();
  expect(screen.getByText('Choose a guest')).toBeTruthy();
});
