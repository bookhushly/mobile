import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState, type ComponentProps } from 'react';
import { Platform } from 'react-native';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { reassignRoom } from '@/features/receptionist/api/deskApi';
import type { RoomRow } from '@/features/receptionist/schemas/desk';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { ChooseRoomSheet } from '@/features/receptionist/ui/ChooseRoomSheet';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { booking, deskWrapper, HOTEL, makeQueryClient } from '../../hooks/__tests__/deskTestUtils';

const mockNow = Date.parse('2026-10-11T09:42:00Z');
const NOW = mockNow;
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
jest.mock('@/features/receptionist/api/deskDb', () => ({
  deskDb: { bookingById: jest.fn(), rooms: jest.fn() },
}));
jest.mock('@/features/receptionist/api/deskApi', () => ({ reassignRoom: jest.fn() }));
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
jest.mock('expo-router', () => ({ useIsFocused: () => true }));
// The RN Modal mock renders nothing once hidden, so the last props are kept to fire a dismissal.
const mockSheet: { last: { visible: boolean; onDismissed?: () => void } | null } = { last: null };
jest.mock('@/shared/ui/Sheet', () => {
  const actual = jest.requireActual<typeof import('@/shared/ui/Sheet')>('@/shared/ui/Sheet');
  return {
    Sheet: (props: ComponentProps<typeof actual.Sheet>) => {
      mockSheet.last = props;
      return <actual.Sheet {...props} />;
    },
  };
});

const mockRooms = jest.spyOn(deskDb, 'rooms');
const mockById = jest.spyOn(deskDb, 'bookingById');
const mockReassign = jest.mocked(reassignRoom);

function room(
  id: string,
  number: number,
  floor: number | null,
  type: string,
  status: RoomRow['status'] = 'available',
): RoomRow {
  return {
    id,
    room_number: number,
    floor,
    status,
    room_type_id: type,
    last_cleaned_at: null,
    hotel_room_types: { name: type === 'deluxe' ? 'Deluxe' : 'Standard' },
  };
}
const CURRENT = room('r204', 204, 2, 'deluxe', 'occupied');
const ROOMS = [
  room('r101', 101, 1, 'standard'),
  room('r102', 102, 1, 'standard', 'dirty'),
  room('r204', 204, 2, 'deluxe'),
  room('r305', 305, 3, 'deluxe'),
  room('r306', 306, 3, 'standard'),
];
const ADA_ROOM = {
  id: CURRENT.id,
  room_number: CURRENT.room_number,
  floor: CURRENT.floor,
  status: CURRENT.status,
  room_type_id: CURRENT.room_type_id,
  hotel_room_types: CURRENT.hotel_room_types,
};
const ADA = booking('b1', { guest_name: 'Ada Obi', hotel_rooms: ADA_ROOM });
const fail = (e: ApiError) => err(e);

// Plays the route: Close (or Open rooms) sets the booking back to null.
function Host(props: { onClose: () => void; onMoved: () => void; onOpenRooms: () => void }) {
  const [open, setOpen] = useState(true);
  return (
    <ChooseRoomSheet
      booking={open ? ADA : null}
      onClose={() => {
        props.onClose();
        setOpen(false);
      }}
      onMoved={props.onMoved}
      onOpenRooms={props.onOpenRooms}
    />
  );
}

async function renderSheet() {
  const qc = makeQueryClient();
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const onClose = jest.fn();
  const onMoved = jest.fn();
  const onOpenRooms = jest.fn();
  const signOut = jest.fn();
  const Wrapper = deskWrapper(qc, { signOut });
  const r = await render(
    <Wrapper>
      <Host onClose={onClose} onMoved={onMoved} onOpenRooms={onOpenRooms} />
    </Wrapper>,
  );
  return { ...r, invalidate, onClose, onMoved, onOpenRooms, signOut };
}

const WITHOUT_305 = ROOMS.filter((r) => r.id !== 'r305');

// The refetch after a move (or a 409) no longer offers Room 305; waiting for that to show lets
// the trailing query update land inside waitFor instead of after the test.
async function gone305() {
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Room 305 · Deluxe' })).toBeNull();
  });
  expect(mockRooms).toHaveBeenCalledTimes(2);
}

// Fake timers (as in RoomsScreen.test): FlatList's 50 ms cell-batching timer otherwise fires
// between act() scopes on a loaded machine (an intermittent "not wrapped in act" warning).
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSheet.last = null;
  useShiftLog.getState().clear();
  mockRooms.mockResolvedValue(ok(ROOMS));
});

it('lists free rooms, same type first, grouped by floor, without the current room', async () => {
  await renderSheet();
  const rows = await screen.findAllByRole('button', { name: /^Room \d+/ });
  expect(rows.map((r) => String(r.props.accessibilityLabel))).toEqual([
    'Room 305 · Deluxe',
    'Room 101 · Standard',
    'Room 306 · Standard',
  ]);
  // Floors are headed in list order; rooms of another type come after their own header.
  const headers = screen
    .getAllByRole('header')
    .map((h) => String(h.props.children))
    .filter((t) => t !== 'Choose another room');
  expect(headers).toEqual(['Floor 3', 'Other room types', 'Floor 1', 'Floor 3']);
});

it('says when there is no free room; on Android Open rooms closes and goes at once', async () => {
  jest.replaceProperty(Platform, 'OS', 'android');
  mockRooms.mockResolvedValue(ok([CURRENT, room('r102', 102, 1, 'standard', 'dirty')]));
  const { onClose, onOpenRooms } = await renderSheet();
  expect(await screen.findByText('No free rooms right now')).toBeTruthy();
  expect(screen.getByText('Mark a cleaned room as available on the Rooms tab.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Open rooms' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onOpenRooms).toHaveBeenCalledTimes(1);
  expect(screen.queryByText('No free rooms right now')).toBeNull();
});

it('on iPhone, Open rooms waits for the sheet to slide away', async () => {
  jest.replaceProperty(Platform, 'OS', 'ios');
  mockRooms.mockResolvedValue(ok([CURRENT]));
  const { onClose, onOpenRooms } = await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Open rooms' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(onOpenRooms).not.toHaveBeenCalled();
  // Hidden but still mounted until iOS reports the dismissal.
  expect(mockSheet.last?.visible).toBe(false);
  await act(() => {
    mockSheet.last?.onDismissed?.();
  });
  expect(onOpenRooms).toHaveBeenCalledTimes(1);
});

it('closing after an uncertain move refetches the desk (the Booking screen does not poll)', async () => {
  mockReassign.mockResolvedValue(fail({ kind: 'timeout' }));
  const { invalidate, onClose } = await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  await screen.findByText("Couldn't confirm the move. It may have gone through.");
  expect(invalidate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] }, { cancelRefetch: false });
});

it('Cancel after an uncertain move also refetches', async () => {
  mockReassign.mockResolvedValue(fail({ kind: 'timeout' }));
  const { invalidate } = await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  await screen.findByText("Couldn't confirm the move. It may have gone through.");
  mockRooms.mockReturnValue(new Promise(() => undefined));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] }, { cancelRefetch: false });
});

it('tap → confirm → Move posts once, logs, refetches and hands back the re-read booking', async () => {
  const moved = {
    ...ADA,
    hotel_rooms: {
      ...ADA_ROOM,
      id: 'r305',
      room_number: 305,
      floor: 3,
      status: 'reserved' as const,
    },
  };
  mockReassign.mockResolvedValue(ok({ success: true, room_number: 305 }));
  mockById.mockResolvedValue(ok(moved));
  const { invalidate, onMoved } = await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  mockRooms.mockResolvedValue(ok(WITHOUT_305));
  expect(screen.getByText('Move Ada Obi to Room 305?')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  await waitFor(() => {
    expect(onMoved).toHaveBeenCalledWith(moved);
  });
  await gone305();
  expect(mockReassign).toHaveBeenCalledTimes(1);
  expect(mockReassign.mock.calls[0]?.slice(1)).toEqual(['b1', 'r305']);
  expect(mockById).toHaveBeenCalledWith(HOTEL, 'b1');
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] }, { cancelRefetch: false });
  expect(useShiftLog.getState().entries).toEqual([
    { at: NOW, kind: 'reassign', text: 'Moved Ada Obi to Room 305' },
  ]);
  expect(mockCue).toHaveBeenCalledWith('success');
});

it('Cancel on the confirm goes back to the list', async () => {
  await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 101 · Standard' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('button', { name: 'Room 101 · Standard' })).toBeTruthy();
  expect(mockReassign).not.toHaveBeenCalled();
});

it('409 means the room was just taken: back to the list with the reason', async () => {
  mockReassign.mockResolvedValue(fail({ kind: 'conflict', code: 'conflict' }));
  await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  mockRooms.mockResolvedValue(ok(WITHOUT_305));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  expect(await screen.findByText('Room 305 was just taken. Choose another.')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Room 101 · Standard' })).toBeTruthy();
  await gone305();
});

it('a timeout is uncertain; Check again re-reads and finishes when the move is there', async () => {
  mockReassign.mockResolvedValue(fail({ kind: 'timeout' }));
  const movedRow = { ...ADA, hotel_rooms: { ...ADA_ROOM, id: 'r305', room_number: 305 } };
  const { onMoved } = await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  mockRooms.mockResolvedValue(ok(WITHOUT_305));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  expect(
    await screen.findByText("Couldn't confirm the move. It may have gone through."),
  ).toBeTruthy();
  // Not there yet: offer Move again, nothing re-posted by itself.
  mockById.mockResolvedValueOnce(ok(ADA));
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByRole('button', { name: 'Move to Room 305' })).toBeTruthy();
  expect(mockReassign).toHaveBeenCalledTimes(1);
  // Second attempt also times out, but this time the re-read finds the new room.
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  await screen.findByText("Couldn't confirm the move. It may have gone through.");
  mockById.mockResolvedValueOnce(ok(movedRow));
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  await waitFor(() => {
    expect(onMoved).toHaveBeenCalledWith(movedRow);
  });
  await gone305();
  expect(useShiftLog.getState().entries).toHaveLength(1);
});

it('403 is a refusal in words', async () => {
  mockReassign.mockResolvedValue(fail({ kind: 'forbidden' }));
  await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  expect(await screen.findByText("You can't change rooms at this hotel.")).toBeTruthy();
  expect(screen.queryByRole('button', { name: /^Move to/ })).toBeNull();
});

it('two quick presses on Move send one request', async () => {
  let answer: (v: ReturnType<typeof fail>) => void = () => undefined;
  mockReassign.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  const move = screen.getByRole('button', { name: 'Move to Room 305' });
  // Same element, before any re-render: both presses see the confirm step.
  await fireEvent.press(move);
  await fireEvent.press(move);
  expect(mockReassign).toHaveBeenCalledTimes(1);
  answer(fail({ kind: 'forbidden' }));
  expect(await screen.findByText("You can't change rooms at this hotel.")).toBeTruthy();
});

it('a 401 after refresh signs out', async () => {
  mockReassign.mockResolvedValue(fail({ kind: 'auth' }));
  const { signOut, onMoved } = await renderSheet();
  await fireEvent.press(await screen.findByRole('button', { name: 'Room 305 · Deluxe' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  await waitFor(() => {
    expect(signOut).toHaveBeenCalledTimes(1);
  });
  expect(onMoved).not.toHaveBeenCalled();
});
