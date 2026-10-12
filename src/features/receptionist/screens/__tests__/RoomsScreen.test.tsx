import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState, type ComponentProps } from 'react';

import { setRoomStatus } from '@/features/receptionist/api/deskApi';
import { deskDb } from '@/features/receptionist/api/deskDb';
import { splitGuests } from '@/features/receptionist/domain/guestLists';
import type { RoomFilter } from '@/features/receptionist/domain/roomBoard';
import { useFreshness } from '@/features/receptionist/hooks/useFreshness';
import { useGuests } from '@/features/receptionist/hooks/useGuests';
import { useRooms } from '@/features/receptionist/hooks/useRooms';
import type { RoomRow } from '@/features/receptionist/schemas/desk';
import { gridColumns, RoomsScreen } from '@/features/receptionist/screens/RoomsScreen';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';
import { useWide } from '@/shared/ui/useWide';

import {
  booking,
  deskWrapper,
  HOTEL,
  makeQueryClient,
  TODAY,
} from '../../hooks/__tests__/deskTestUtils';

const mockNow = Date.parse('2026-10-11T09:42:00Z');
const NOW = mockNow;
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
// Factories, not automocks: an automock loads the real module (supabase → native storage).
jest.mock('@/features/receptionist/api/deskDb', () => ({ deskDb: { staffHotels: jest.fn() } }));
jest.mock('@/features/receptionist/api/deskApi', () => ({ setRoomStatus: jest.fn() }));
jest.mock('@/features/receptionist/hooks/useRooms', () => ({ useRooms: jest.fn() }));
jest.mock('@/features/receptionist/hooks/useGuests', () => ({ useGuests: jest.fn() }));
jest.mock('@/features/receptionist/hooks/useFreshness', () => ({ useFreshness: jest.fn() }));
jest.mock('@/shared/ui/useWide', () => ({ useWide: jest.fn() }));
// Counts Modal sheets mounted: switching views must keep the one sheet, never swap it.
const mockSheetMounts = { count: 0 };
jest.mock('@/shared/ui/Sheet', () => {
  const actual = jest.requireActual<typeof import('@/shared/ui/Sheet')>('@/shared/ui/Sheet');
  const { useEffect: useMountEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    Sheet: (props: ComponentProps<typeof actual.Sheet>) => {
      useMountEffect(() => {
        mockSheetMounts.count += 1;
      }, []);
      return <actual.Sheet {...props} />;
    },
  };
});
const mockCue = jest.fn();
jest.mock('@/shared/platform/feedback', () => ({
  createFeedback: () => ({
    load: () => Promise.resolve(),
    cue: mockCue,
    isMuted: () => false,
    setMuted: () => Promise.resolve(),
    release: () => undefined,
  }),
}));

const mockRooms = jest.mocked(useRooms);
const mockGuests = jest.mocked(useGuests);
const mockWide = jest.mocked(useWide);
const mockSet = jest.mocked(setRoomStatus);
const mockStaff = jest.spyOn(deskDb, 'staffHotels');
const fail = (e: ApiError) => err(e);

function room(number: number, status: RoomRow['status'], over: Partial<RoomRow> = {}): RoomRow {
  return {
    id: `r${String(number)}`,
    room_number: number,
    floor: Math.floor(number / 100),
    status,
    room_type_id: 'deluxe',
    last_cleaned_at: null,
    hotel_room_types: { name: 'Deluxe' },
    ...over,
  };
}
const ROOMS: RoomRow[] = [
  room(101, 'available', { last_cleaned_at: '2026-10-11T08:12:00Z' }),
  room(102, 'available', { last_cleaned_at: '2026-10-10T08:12:00Z' }),
  room(103, 'dirty'),
  room(204, 'occupied'),
  room(205, 'reserved'),
  room(306, 'under_maintenance', { hotel_room_types: null, floor: null }),
];
const ADA = booking('b1', {
  guest_name: 'Ada Obi',
  booking_status: 'checked_in',
  checked_in: true,
  hotel_rooms: {
    id: 'r204',
    room_number: 204,
    floor: 2,
    status: 'occupied',
    room_type_id: 'deluxe',
    hotel_room_types: { name: 'Deluxe' },
  },
});

function roomsReady(rows: RoomRow[], over: Partial<ReturnType<typeof useRooms>> = {}) {
  mockRooms.mockReturnValue({
    rooms: rows,
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    updatedAt: 1,
    ...over,
  });
}

// The route owns the filter; this harness plays the route.
function Harness(
  props: Omit<ComponentProps<typeof RoomsScreen>, 'filter' | 'onFilterChange'> & {
    initial: RoomFilter;
  },
) {
  const [filter, setFilter] = useState<RoomFilter>(props.initial);
  return (
    <RoomsScreen filter={filter} onFilterChange={setFilter} onOpenBooking={props.onOpenBooking} />
  );
}

async function renderRooms(initial: RoomFilter = 'all') {
  const qc = makeQueryClient();
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const onOpenBooking = jest.fn();
  const signOut = jest.fn();
  const Wrapper = deskWrapper(qc, { signOut });
  const tree = () => (
    <Wrapper>
      <Harness initial={initial} onOpenBooking={onOpenBooking} />
    </Wrapper>
  );
  await render(tree());
  // Re-render with whatever useRooms now returns (the board refetched).
  const rerender = () => screen.rerender(tree());
  return { qc, invalidate, onOpenBooking, signOut, rerender };
}

const roomRows = () =>
  screen
    .getAllByRole('button', { name: /^Room \d+/ })
    .map((r) => String(r.props.accessibilityLabel));

async function openRoom(n: number) {
  await fireEvent.press(screen.getByRole('button', { name: new RegExp(`^Room ${String(n)},`) }));
  await screen.findByRole('header', { name: `Room ${String(n)}` });
}

async function markAvailable() {
  await openRoom(103);
  await fireEvent.press(screen.getByRole('radio', { name: 'Available' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
}

// Fake timers: FlatList's 50 ms cell-batching timer otherwise fires between act() scopes on a
// loaded machine (an intermittent "not wrapped in act" warning). RNTL advances them in waitFor.
afterEach(() => {
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSheetMounts.count = 0;
  useShiftLog.getState().clear();
  mockWide.mockReturnValue(false);
  jest.mocked(useFreshness).mockReturnValue(null);
  mockGuests.mockReturnValue({
    lists: splitGuests([ADA], TODAY),
    rows: [ADA],
    loading: false,
    error: false,
    refetch: jest.fn(() => Promise.resolve()),
    updatedAt: 1,
  });
  roomsReady(ROOMS);
});

it('chips carry counts and hide empty statuses; rows show type, floor, status and cleaned today', async () => {
  await renderRooms();
  expect(screen.getByRole('header', { name: 'Rooms' })).toBeTruthy();
  const chips = screen.getAllByRole('radio').map((c) => String(c.props.accessibilityLabel));
  expect(chips).toEqual([
    'All 6',
    'Available 2',
    'Occupied 1',
    'Dirty 1',
    'Reserved 1',
    'Maintenance 1',
  ]);
  expect(screen.getByRole('radio', { name: 'All 6' })).toBeChecked();
  expect(roomRows()).toEqual([
    'Room 101, Deluxe · Floor 1, Available, Cleaned 09:12',
    'Room 102, Deluxe · Floor 1, Available',
    'Room 103, Deluxe · Floor 1, Dirty',
    'Room 204, Deluxe · Floor 2, Occupied',
    'Room 205, Deluxe · Floor 2, Reserved',
    'Room 306, Maintenance',
  ]);
  await fireEvent.press(screen.getByRole('radio', { name: 'Dirty 1' }));
  expect(roomRows()).toEqual(['Room 103, Deluxe · Floor 1, Dirty']);
});

it('starts on the filter the route asks for, and an empty one says so', async () => {
  roomsReady(ROOMS.filter((r) => r.status !== 'available'));
  await renderRooms('available');
  // The active chip stays even at zero, so it can be switched off.
  expect(screen.getByRole('radio', { name: 'Available 0' })).toBeChecked();
  expect(screen.getByText('No rooms are available right now.')).toBeTruthy();
});

it('shows a skeleton on the first load', async () => {
  roomsReady([], { loading: true });
  await renderRooms();
  expect(screen.queryByRole('button', { name: /^Room / })).toBeNull();
  expect(screen.queryByText(/No rooms/)).toBeNull();
});

it('a failed load says so and retries', async () => {
  const refetch = jest.fn(() => Promise.resolve());
  roomsReady([], { error: true, refetch });
  await renderRooms();
  expect(screen.getByText("Couldn't load rooms")).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('an occupied room shows its guest with a link to the booking, and no Save', async () => {
  const { onOpenBooking } = await renderRooms();
  await openRoom(204);
  expect(
    screen.getByText('A guest is checked in. Check them out first to change this room.'),
  ).toBeTruthy();
  expect(screen.getByText('Ada Obi')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(screen.queryByRole('radio', { name: 'Available' })).toBeNull();
  await fireEvent.press(screen.getByRole('link', { name: "Open Ada Obi's booking" }));
  expect(onOpenBooking).toHaveBeenCalledWith('b1');
  expect(screen.queryByRole('header', { name: 'Room 204' })).toBeNull();
});

it('dirty → available → Save sends it, logs it, refetches and closes', async () => {
  mockSet.mockResolvedValue(ok({ success: true }));
  const { invalidate } = await renderRooms();
  await openRoom(103);
  expect(screen.getByRole('radio', { name: 'Dirty' })).toBeChecked();
  // Nothing changed yet.
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  await fireEvent.press(screen.getByRole('radio', { name: 'Available' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Save' }));
  await waitFor(() => {
    expect(screen.queryByRole('header', { name: 'Room 103' })).toBeNull();
  });
  expect(mockSet).toHaveBeenCalledTimes(1);
  expect(mockSet.mock.calls[0]?.slice(1)).toEqual(['r103', 'available']);
  expect(useShiftLog.getState().entries).toEqual([
    { at: NOW, kind: 'roomStatus', text: 'Room 103 marked available' },
  ]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] });
  expect(mockCue).toHaveBeenCalledWith('success');
});

it('409 means a guest was just checked in', async () => {
  mockSet.mockResolvedValue(fail({ kind: 'conflict', code: 'conflict' }));
  const { invalidate } = await renderRooms();
  await markAvailable();
  expect(await screen.findByText('A guest was just checked in to this room.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL, 'rooms'] });
  expect(mockStaff).not.toHaveBeenCalled();
});

it('after a 409 the board shows the room occupied: the same sheet switches to the guest view', async () => {
  mockSet.mockResolvedValue(fail({ kind: 'conflict', code: 'conflict' }));
  const { rerender } = await renderRooms();
  await markAvailable();
  await screen.findByText('A guest was just checked in to this room.');
  expect(mockSheetMounts.count).toBe(1);
  roomsReady(ROOMS.map((r) => (r.id === 'r103' ? { ...r, status: 'occupied' as const } : r)));
  await rerender();
  expect(
    screen.getByText('A guest is checked in. Check them out first to change this room.'),
  ).toBeTruthy();
  expect(screen.getByText('A guest was just checked in to this room.')).toBeTruthy();
  expect(screen.getByRole('header', { name: 'Room 103' })).toBeTruthy();
  expect(screen.queryByRole('radio', { name: 'Available' })).toBeNull();
  expect(mockSheetMounts.count).toBe(1);
});

it('the radio follows the room until the desk picks, and resets when the status changes', async () => {
  const { rerender } = await renderRooms();
  await openRoom(103);
  expect(screen.getByRole('radio', { name: 'Dirty' })).toBeChecked();
  // Cleaned elsewhere: the selection follows, and there is nothing to save.
  roomsReady(ROOMS.map((r) => (r.id === 'r103' ? { ...r, status: 'available' as const } : r)));
  await rerender();
  expect(screen.getByRole('radio', { name: 'Available' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  // A pick sticks until the room changes again underneath.
  await fireEvent.press(screen.getByRole('radio', { name: 'Reserved' }));
  expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled();
  roomsReady(ROOMS.map((r) => (r.id === 'r103' ? { ...r, status: 'dirty' as const } : r)));
  await rerender();
  expect(screen.getByRole('radio', { name: 'Dirty' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  expect(mockSheetMounts.count).toBe(1);
});

it('404 says the room is gone', async () => {
  mockSet.mockResolvedValue(fail({ kind: 'notFound' }));
  await renderRooms();
  await markAvailable();
  expect(await screen.findByText('This room no longer exists.')).toBeTruthy();
});

it('403 with the hotel still on the staff row is transient: neutral, and Try again re-sends', async () => {
  mockSet.mockResolvedValueOnce(fail({ kind: 'forbidden' }));
  mockStaff.mockResolvedValue(ok([{ hotel_id: HOTEL, hotels: null }]));
  await renderRooms();
  await markAvailable();
  expect(await screen.findByText("Couldn't save. Try again.")).toBeTruthy();
  expect(mockStaff).toHaveBeenCalledTimes(1);
  expect(mockStaff).toHaveBeenCalledWith('u1');
  expect(screen.queryByText("You can't change rooms at this hotel.")).toBeNull();
  mockSet.mockResolvedValueOnce(ok({ success: true }));
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() => {
    expect(screen.queryByRole('header', { name: 'Room 103' })).toBeNull();
  });
  expect(mockSet).toHaveBeenCalledTimes(2);
});

it('403 with the hotel gone from the staff row is a refusal', async () => {
  mockSet.mockResolvedValue(fail({ kind: 'forbidden' }));
  mockStaff.mockResolvedValue(ok([{ hotel_id: 'other', hotels: null }]));
  await renderRooms();
  await markAvailable();
  expect(await screen.findByText("You can't change rooms at this hotel.")).toBeTruthy();
  expect(mockStaff).toHaveBeenCalledTimes(1);
  expect(mockCue).toHaveBeenCalledWith('error');
});

it('a timeout is neutral and may be tried again (the change is idempotent)', async () => {
  mockSet.mockResolvedValue(fail({ kind: 'timeout' }));
  const { invalidate } = await renderRooms();
  await markAvailable();
  expect(await screen.findByText("Couldn't confirm. Check the board and try again.")).toBeTruthy();
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL, 'rooms'] });
  expect(screen.getByRole('button', { name: 'Try again' })).toBeEnabled();
});

it('429 holds Save for the countdown', async () => {
  mockSet.mockResolvedValue(fail({ kind: 'rateLimited', retryAfterSec: 8 }));
  await renderRooms();
  await markAvailable();
  expect(
    await screen.findByText(
      "This hotel's network is sending too many requests — try again in 8 s.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
});

it('two quick presses on Save send one request', async () => {
  let answer: (v: ReturnType<typeof fail>) => void = () => undefined;
  mockSet.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  await renderRooms();
  await openRoom(103);
  await fireEvent.press(screen.getByRole('radio', { name: 'Available' }));
  const save = screen.getByRole('button', { name: 'Save' });
  await fireEvent.press(save);
  await fireEvent.press(save);
  expect(mockSet).toHaveBeenCalledTimes(1);
  answer(fail({ kind: 'notFound' }));
  expect(await screen.findByText('This room no longer exists.')).toBeTruthy();
});

it('a tablet shows the board as a grid of tiles that open the same sheet', async () => {
  mockWide.mockReturnValue(true);
  await renderRooms();
  expect(screen.getAllByTestId(/^room-tile-/)).toHaveLength(6);
  expect(screen.getByRole('button', { name: 'Room 306, Maintenance' })).toBeTruthy();
  await fireEvent.press(screen.getByTestId('room-tile-r205'));
  expect(await screen.findByRole('header', { name: 'Room 205' })).toBeTruthy();
  expect(screen.getByRole('radio', { name: 'Reserved' })).toBeChecked();
});

it('fits as many 140 pt tiles as the width allows, at least one', () => {
  expect(gridColumns(0)).toBe(1);
  expect(gridColumns(139)).toBe(1);
  expect(gridColumns(140)).toBe(1);
  // n tiles need n × 140 + (n − 1) × 8 (gap s3).
  expect(gridColumns(287)).toBe(1);
  expect(gridColumns(288)).toBe(2);
  expect(gridColumns(600)).toBe(4);
  expect(gridColumns(900)).toBe(6);
});
