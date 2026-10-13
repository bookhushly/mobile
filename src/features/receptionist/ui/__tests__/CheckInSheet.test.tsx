import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { QueryClient } from '@tanstack/react-query';
import { Platform } from 'react-native';

import { deskDb } from '@/features/receptionist/api/deskDb';
import { checkIn, reassignRoom } from '@/features/receptionist/api/deskApi';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { CheckInSheet } from '@/features/receptionist/ui/CheckInSheet';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { booking, deskWrapper, HOTEL, makeQueryClient } from '../../hooks/__tests__/deskTestUtils';

// 2026-10-11 10:42 Lagos (09:42Z) by the server clock.
const NOW = Date.parse('2026-10-11T09:42:00Z');
let mockNow = NOW;
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
jest.mock('@/features/receptionist/api/deskDb', () => ({
  deskDb: { bookingByCode: jest.fn(), bookingById: jest.fn(), rooms: jest.fn() },
}));
jest.mock('@/features/receptionist/api/deskApi', () => ({
  checkIn: jest.fn(),
  reassignRoom: jest.fn(),
}));
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

// The camera stub: a button that "scans" mockCamera.raw; the prompt renders its copy. It counts
// mounts/unmounts and reports `paused` in its label.
const mockCamera = {
  raw: 'AB12CD34',
  permission: 'granted' as string,
  mounts: 0,
  unmounts: 0,
};
jest.mock('@/shared/ui/camera', () => {
  const { Pressable, Text: RNText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    QrCamera: ({ onCode, paused }: { onCode: (raw: string) => void; paused: boolean }) => {
      useEffect(() => {
        mockCamera.mounts += 1;
        return () => {
          mockCamera.unmounts += 1;
        };
      }, []);
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={paused ? 'fake-camera-paused' : 'fake-camera'}
          onPress={() => {
            onCode(mockCamera.raw);
          }}
        >
          <RNText>camera</RNText>
        </Pressable>
      );
    },
    CameraPrompt: ({ askTitle, tone }: { askTitle: string; tone?: string }) => (
      <RNText>{`${askTitle} [${tone ?? 'unset'}]`}</RNText>
    ),
    useAppActive: () => true,
    useCameraAccess: () => ({
      permission: mockCamera.permission,
      canAsk: true,
      request: jest.fn(),
    }),
  };
});

const mockByCode = jest.spyOn(deskDb, 'bookingByCode');
const mockById = jest.spyOn(deskDb, 'bookingById');
const mockCheckIn = jest.mocked(checkIn);
const mockReassign = jest.mocked(reassignRoom);
const mockRooms = jest.spyOn(deskDb, 'rooms');

const ROOM = {
  id: 'r204',
  room_number: 204,
  floor: 2,
  status: 'available' as const,
  room_type_id: 'deluxe',
  hotel_room_types: { name: 'Deluxe' },
};
const ADA = booking('b1', {
  guest_name: 'Ada Obi',
  check_in_code: 'AB12CD34',
  hotel_rooms: ROOM,
});

const fail = (e: ApiError) => err(e);

async function renderSheet(code: string | null = null) {
  const qc = makeQueryClient();
  clients.push(qc);
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const onClose = jest.fn();
  const onOpenRooms = jest.fn();
  const signOut = jest.fn();
  const Wrapper = deskWrapper(qc, { signOut });
  const r = await render(
    <Wrapper>
      <CheckInSheet visible request={{ id: 1, code }} onClose={onClose} onOpenRooms={onOpenRooms} />
    </Wrapper>,
  );
  return { ...r, qc, invalidate, onClose, onOpenRooms, signOut };
}

async function typeAndFind(raw: string) {
  await fireEvent.changeText(screen.getByLabelText('Check-in code'), raw);
  await fireEvent.press(screen.getByRole('button', { name: 'Find booking' }));
}

async function toPreview() {
  mockByCode.mockResolvedValue(ok(ADA));
  await typeAndFind('ab12cd34');
  await screen.findByRole('header', { name: 'Ada Obi' });
}

// Fake timers (as in RoomsScreen.test): the room step's FlatList batching timer otherwise fires
// between act() scopes on a loaded machine (an intermittent "not wrapped in act" warning).
// RNTL's waitFor advances them. Each test unmounts, clears its query client and flushes pending
// timers (FlatList batching, TanStack's notify/gc timers) before real timers come back, so none
// fires after the test.
const clients: QueryClient[] = [];

afterEach(async () => {
  await cleanup();
  for (const qc of clients.splice(0)) qc.clear();
  // Flushed inside act() (never cleared: React's scheduler has timers in the queue too).
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
  jest.useRealTimers();
});

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockNow = NOW;
  mockCamera.raw = 'AB12CD34';
  mockCamera.permission = 'granted';
  mockCamera.mounts = 0;
  mockCamera.unmounts = 0;
  useShiftLog.getState().clear();
});

it('type a code → preview → Check in → done, with a shift-log entry and a refetch', async () => {
  mockCheckIn.mockResolvedValue(ok({ success: true }));
  const { invalidate, onClose } = await renderSheet();
  expect(screen.getByRole('header', { name: 'Check in a guest' })).toBeTruthy();
  await toPreview();
  expect(mockByCode).toHaveBeenCalledWith(HOTEL, 'AB12CD34');
  expect(screen.getByRole('header', { name: 'Check in Ada' })).toBeTruthy();
  expect(screen.getByText(/Room 204/)).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(await screen.findByText('Checked in · Room 204')).toBeTruthy();
  expect(mockCheckIn).toHaveBeenCalledTimes(1);
  expect(mockCheckIn.mock.calls[0]?.[1]).toBe('b1');
  expect(screen.getByRole('header', { name: 'Checked in' })).toBeTruthy();
  expect(useShiftLog.getState().entries).toEqual([
    { at: NOW, kind: 'checkIn', text: 'Checked in Ada Obi · Room 204' },
  ]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] }, { cancelRefetch: false });
  expect(mockCue).toHaveBeenCalledWith('success');

  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('opening with a code looks it up straight away', async () => {
  mockByCode.mockResolvedValue(ok(ADA));
  await renderSheet('AB12CD34');
  expect(await screen.findByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  expect(mockByCode).toHaveBeenCalledTimes(1);
});

it('an event ticket is refused in the field without a lookup', async () => {
  await renderSheet();
  await typeAndFind('BH2.abc.def');
  expect(screen.getByText("That's an event ticket, not a hotel check-in code.")).toBeTruthy();
  expect(mockByCode).not.toHaveBeenCalled();
  await typeAndFind('');
  expect(screen.getByText("Enter the guest's 8-character code.")).toBeTruthy();
  await typeAndFind('ABC');
  expect(screen.getByText('Check-in codes are 8 letters and numbers.')).toBeTruthy();
});

it('no booking → the code and hotel in words; a failed lookup is neutral with Try again', async () => {
  mockByCode.mockResolvedValueOnce(ok(null));
  await renderSheet();
  await typeAndFind('ab12cd34');
  expect(
    await screen.findByText(
      'No booking with code AB12CD34 at Eko Suites. Check the code with the guest.',
    ),
  ).toBeTruthy();
  // The field is still there for a corrected code.
  mockByCode.mockResolvedValueOnce(fail({ kind: 'network' }));
  await typeAndFind('ab12cd35');
  expect(
    await screen.findByText("Couldn't look up the code. Check the connection and try again."),
  ).toBeTruthy();
  mockByCode.mockResolvedValueOnce(ok(ADA));
  await fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  expect(mockByCode).toHaveBeenLastCalledWith(HOTEL, 'AB12CD35');
});

it('a timeout is uncertain; Check again that finds our check-in shows done', async () => {
  mockCheckIn.mockResolvedValue(fail({ kind: 'timeout' }));
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(
    await screen.findByText("Couldn't confirm the check-in. It may have gone through."),
  ).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
  // Checked in 10 s after we sent: ours.
  mockById.mockResolvedValue(
    ok({
      ...ADA,
      booking_status: 'checked_in',
      checked_in: true,
      checked_in_at: '2026-10-11T09:42:10Z',
    }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('Checked in · Room 204')).toBeTruthy();
  expect(mockCheckIn).toHaveBeenCalledTimes(1);
  expect(mockById).toHaveBeenCalledWith(HOTEL, 'b1');
  expect(useShiftLog.getState().entries).toHaveLength(1);
});

it('done via Check again keeps the early-arrival note', async () => {
  const early = { ...ADA, check_in_date: '2026-10-13' };
  mockByCode.mockResolvedValue(ok(early));
  mockCheckIn.mockResolvedValue(fail({ kind: 'timeout' }));
  await renderSheet();
  await typeAndFind('ab12cd34');
  await fireEvent.press(await screen.findByRole('button', { name: 'Check in' }));
  await screen.findByText("Couldn't confirm the check-in. It may have gone through.");
  mockById.mockResolvedValue(
    ok({
      ...early,
      booking_status: 'checked_in',
      checked_in: true,
      checked_in_at: '2026-10-11T09:42:10Z',
    }),
  );
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('Checked in · Room 204')).toBeTruthy();
  expect(screen.getByText(/2 days early/)).toBeTruthy();
});

it('Check again that finds it still confirmed returns to the preview with Check in enabled', async () => {
  mockCheckIn.mockResolvedValue(fail({ kind: 'network' }));
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  await screen.findByText("Couldn't confirm the check-in. It may have gone through.");
  mockById.mockResolvedValue(ok(ADA));
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  const again = await screen.findByRole('button', { name: 'Check in' });
  expect(again).toBeEnabled();
  expect(useShiftLog.getState().entries).toHaveLength(0);
});

it('a failed re-read keeps the uncertain state (no second post)', async () => {
  mockCheckIn.mockResolvedValue(fail({ kind: 'unavailable', status: 503 }));
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  await screen.findByText("Couldn't confirm the check-in. It may have gone through.");
  mockById.mockResolvedValueOnce(fail({ kind: 'network' }));
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByRole('button', { name: 'Check again' })).toBeTruthy();
  expect(mockCheckIn).toHaveBeenCalledTimes(1);
});

it('409 already_checked_in after our send re-reads; an earlier check-in is "elsewhere"', async () => {
  mockCheckIn.mockResolvedValue(
    fail({
      kind: 'conflict',
      code: 'already_checked_in',
      body: { checked_in_at: '2026-10-11T08:42:00Z' },
    }),
  );
  mockById.mockResolvedValue(
    ok({
      ...ADA,
      booking_status: 'checked_in',
      checked_in: true,
      checked_in_at: '2026-10-11T08:42:00Z',
    }),
  );
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(
    await screen.findByText('Already checked in at 09:42 (by another desk or device).'),
  ).toBeTruthy();
  expect(mockCheckIn).toHaveBeenCalledTimes(1);
  expect(useShiftLog.getState().entries).toHaveLength(0);
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
});

it('400 not_paid is a refusal in words with no Check in', async () => {
  mockCheckIn.mockResolvedValue(fail({ kind: 'unknown', status: 400, code: 'not_paid' }));
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(await screen.findByText(/Payment hasn't been completed/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
  expect(mockCue).toHaveBeenCalledWith('error');
});

it('409 room_occupied offers Choose another room, and a move updates the preview', async () => {
  mockCheckIn.mockResolvedValue(
    fail({ kind: 'conflict', code: 'room_occupied', body: { room_number: 204 } }),
  );
  const r305 = { ...ROOM, id: 'r305', room_number: 305, floor: 3 };
  // The refetch after the move stays in flight: the panel has closed by then and nothing on
  // screen depends on it, so its answer would only land after the test.
  mockRooms
    .mockResolvedValueOnce(ok([{ ...r305, last_cleaned_at: null }]))
    .mockReturnValue(new Promise(() => undefined));
  const moved = { ...ADA, hotel_rooms: r305 };
  mockReassign.mockResolvedValue(ok({ success: true, room_number: 305 }));
  mockById.mockResolvedValue(ok(moved));
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(await screen.findByText('Room 204 still has a guest checked in.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose another room' }));
  // A step inside the same sheet (iOS can't stack a second Modal on a page sheet).
  expect(screen.getByRole('header', { name: 'Choose another room' })).toBeTruthy();
  expect(screen.getAllByTestId('check-in-sheet')).toHaveLength(1);
  expect(screen.queryByTestId('choose-room-sheet')).toBeNull();
  await fireEvent.press(await screen.findByRole('button', { name: /Room 305/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  await waitFor(() => {
    expect(mockReassign.mock.calls[0]?.slice(1)).toEqual(['b1', 'r305']);
  });
  // Back on the preview with the new room and Check in offered again.
  expect(await screen.findByText(/Room 305/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Check in' })).toBeTruthy();
  expect(screen.queryByText('Room 204 still has a guest checked in.')).toBeNull();
});

it('Cancel on the room list goes back to the refusal without moving', async () => {
  // The server named no room: the booking's own room stands in.
  mockCheckIn.mockResolvedValue(fail({ kind: 'conflict', code: 'room_occupied', body: {} }));
  mockRooms.mockResolvedValue(
    ok([{ ...ROOM, id: 'r305', room_number: 305, last_cleaned_at: null }]),
  );
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(await screen.findByText('Room 204 still has a guest checked in.')).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Choose another room' }));
  await screen.findByRole('button', { name: /Room 305/ });
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByText('Room 204 still has a guest checked in.')).toBeTruthy();
  expect(mockReassign).not.toHaveBeenCalled();
});

it('a 401 on the in-sheet move signs out', async () => {
  mockCheckIn.mockResolvedValue(
    fail({ kind: 'conflict', code: 'room_occupied', body: { room_number: 204 } }),
  );
  mockRooms.mockResolvedValue(
    ok([{ ...ROOM, id: 'r305', room_number: 305, last_cleaned_at: null }]),
  );
  mockReassign.mockResolvedValue(fail({ kind: 'auth' }));
  const { signOut } = await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose another room' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Room 305/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  await waitFor(() => {
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

it('403 is a refusal; 429 is neutral with a countdown that re-enables Check in', async () => {
  mockCheckIn.mockResolvedValueOnce(fail({ kind: 'forbidden' }));
  const first = await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(await screen.findByText("You can't check in guests at this hotel.")).toBeTruthy();
  await first.unmount();

  mockCheckIn.mockResolvedValueOnce(fail({ kind: 'rateLimited', retryAfterSec: 12 }));
  await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(
    await screen.findByText(
      "This hotel's network is sending too many requests — try again in 12 s.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Check in' })).toBeDisabled();
  // The sheet ticks on the server clock (a 1 s interval; waitFor advances the fake timers).
  mockNow = NOW + 12_000;
  await waitFor(
    () => {
      expect(screen.getByRole('button', { name: 'Check in' })).toBeEnabled();
    },
    { timeout: 3000 },
  );
  // One post per render so far (403, then 429): nothing was re-posted on its own.
  expect(mockCheckIn).toHaveBeenCalledTimes(2);
  mockCheckIn.mockResolvedValueOnce(ok({ success: true }));
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  expect(await screen.findByText('Checked in · Room 204')).toBeTruthy();
  expect(mockCheckIn).toHaveBeenCalledTimes(3);
});

it('a 401 after refresh hands over to the session-expired path', async () => {
  mockCheckIn.mockResolvedValue(fail({ kind: 'auth' }));
  const { signOut } = await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  await waitFor(() => {
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

it('an in-house or unpaid preview has no Check in button', async () => {
  mockByCode.mockResolvedValue(
    ok({
      ...ADA,
      booking_status: 'checked_in',
      checked_in: true,
      checked_in_at: '2026-10-11T09:00:00Z',
    }),
  );
  await renderSheet();
  await typeAndFind('ab12cd34');
  expect(await screen.findByText('Already checked in at 10:00.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Check in' })).toBeNull();
  expect(mockCheckIn).not.toHaveBeenCalled();
  // Check-in context: the early-leave note (a check-out warning) isn't shown.
  expect(screen.queryByText(/early\./)).toBeNull();
});

it('a check-in on an earlier day is said with its date', async () => {
  mockByCode.mockResolvedValue(
    ok({
      ...ADA,
      booking_status: 'checked_in',
      checked_in: true,
      checked_in_at: '2026-10-10T09:00:00Z',
    }),
  );
  await renderSheet();
  await typeAndFind('ab12cd34');
  expect(await screen.findByText('Already checked in on Sat 10 Oct at 10:00.')).toBeTruthy();
});

it('scan: the camera mounts only on the Scan tab; one lookup per scanned code', async () => {
  mockByCode.mockResolvedValue(ok(ADA));
  await renderSheet();
  expect(screen.queryByRole('button', { name: 'fake-camera' })).toBeNull();
  await fireEvent.press(screen.getByRole('tab', { name: 'Scan QR' }));
  const cam = screen.getByRole('button', { name: 'fake-camera' });
  await fireEvent.press(cam);
  await fireEvent.press(cam);
  expect(await screen.findByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  expect(mockByCode).toHaveBeenCalledTimes(1);
  // Not in entry any more: the camera is gone.
  expect(screen.queryByRole('button', { name: 'fake-camera' })).toBeNull();
});

it('scan: the camera stays mounted, paused, while a scanned code is looked up', async () => {
  let answer: (v: Awaited<ReturnType<typeof deskDb.bookingByCode>>) => void = () => undefined;
  mockByCode.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  await renderSheet();
  await fireEvent.press(screen.getByRole('tab', { name: 'Scan QR' }));
  expect(mockCamera.mounts).toBe(1);
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  // Looking: the same camera, paused, under a spinner.
  expect(screen.getByRole('button', { name: 'fake-camera-paused' })).toBeTruthy();
  expect(screen.getByLabelText('Finding booking…')).toBeTruthy();
  await act(() => {
    answer(ok(null));
  });
  expect(await screen.findByText(/No booking with code AB12CD34/)).toBeTruthy();
  expect(screen.getByRole('button', { name: 'fake-camera' })).toBeTruthy();
  expect(mockCamera.mounts).toBe(1);
  expect(mockCamera.unmounts).toBe(0);
});

it('scan: after "no booking" the camera keeps running; the same code waits for an edit', async () => {
  mockByCode.mockResolvedValue(ok(null));
  await renderSheet();
  await fireEvent.press(screen.getByRole('tab', { name: 'Scan QR' }));
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  expect(await screen.findByText(/No booking with code AB12CD34/)).toBeTruthy();
  const cam = screen.getByRole('button', { name: 'fake-camera' });
  await fireEvent.press(cam);
  expect(mockByCode).toHaveBeenCalledTimes(1);
  // A different code goes straight through.
  mockCamera.raw = 'CD34AB12';
  mockByCode.mockResolvedValue(ok(ADA));
  await fireEvent.press(cam);
  expect(await screen.findByRole('header', { name: 'Ada Obi' })).toBeTruthy();
  expect(mockByCode).toHaveBeenLastCalledWith(HOTEL, 'CD34AB12');
});

it('scan: the prompt uses the light tone and offers typing instead', async () => {
  mockCamera.permission = 'unknown';
  await renderSheet();
  await fireEvent.press(screen.getByRole('tab', { name: 'Scan QR' }));
  expect(screen.getByText('Allow camera to scan check-in codes [default]')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'fake-camera' })).toBeNull();
});

it('a scanned event ticket is told apart and never looked up', async () => {
  mockCamera.raw = 'BH2.eyJ.sig';
  await renderSheet();
  await fireEvent.press(screen.getByRole('tab', { name: 'Scan QR' }));
  await fireEvent.press(screen.getByRole('button', { name: 'fake-camera' }));
  expect(screen.getByText("That's an event ticket, not a hotel check-in code.")).toBeTruthy();
  expect(mockByCode).not.toHaveBeenCalled();
});

it('closing after an uncertain check-in refetches the desk (the Booking screen does not poll)', async () => {
  mockCheckIn.mockResolvedValue(fail({ kind: 'timeout' }));
  const { invalidate, onClose } = await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  await screen.findByText("Couldn't confirm the check-in. It may have gone through.");
  expect(invalidate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] }, { cancelRefetch: false });
});

it('closing without an uncertain outcome does not refetch', async () => {
  const { invalidate, onClose } = await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(invalidate).not.toHaveBeenCalled();
});

it('a room marked not ready makes Choose another room the primary action', async () => {
  mockByCode.mockResolvedValue(
    ok({ ...ADA, hotel_rooms: { ...ROOM, status: 'under_maintenance' as const } }),
  );
  await renderSheet();
  await typeAndFind('ab12cd34');
  await screen.findByRole('button', { name: 'Choose another room' });
  const order = screen.getAllByRole('button').map((b) => String(b.props.accessibilityLabel));
  // Primary first in the footer; Check in is still offered (R15), as the secondary.
  expect(order.indexOf('Choose another room')).toBeLessThan(order.indexOf('Check in'));
  expect(screen.getByRole('button', { name: 'Check in' })).toBeEnabled();
});

it('an uncertain in-sheet move says it may have gone through; closing then refetches', async () => {
  mockCheckIn.mockResolvedValue(
    fail({ kind: 'conflict', code: 'room_occupied', body: { room_number: 204 } }),
  );
  // The refetch that closing triggers stays in flight: nothing on screen waits for it.
  mockRooms
    .mockResolvedValueOnce(ok([{ ...ROOM, id: 'r305', room_number: 305, last_cleaned_at: null }]))
    .mockReturnValue(new Promise(() => undefined));
  mockReassign.mockResolvedValue(fail({ kind: 'timeout' }));
  const { invalidate, onClose } = await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose another room' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Room 305/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move to Room 305' }));
  expect(
    await screen.findByText("Couldn't confirm the move. It may have gone through."),
  ).toBeTruthy();
  await fireEvent.press(screen.getByRole('button', { name: 'Close' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] }, { cancelRefetch: false });
});

describe('no free rooms → Open rooms', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  async function toEmptyPicker() {
    mockCheckIn.mockResolvedValue(
      fail({ kind: 'conflict', code: 'room_occupied', body: { room_number: 204 } }),
    );
    mockRooms.mockResolvedValue(ok([]));
    const r = await renderSheet();
    await toPreview();
    await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
    await fireEvent.press(await screen.findByRole('button', { name: 'Choose another room' }));
    expect(await screen.findByText('No free rooms right now')).toBeTruthy();
    return r;
  }

  it('on iPhone, closes the sheet and opens Rooms once it has gone', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    const { onClose, onOpenRooms } = await toEmptyPicker();
    await fireEvent.press(screen.getByRole('button', { name: 'Open rooms' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenRooms).not.toHaveBeenCalled();
    // The RN Modal mock can't render a hidden sheet, so its dismissal is fired directly.
    await fireEvent(screen.getByTestId('check-in-sheet'), 'dismiss');
    expect(onOpenRooms).toHaveBeenCalledTimes(1);
  });

  it('on Android, closes the sheet and opens Rooms at once', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    const { onClose, onOpenRooms } = await toEmptyPicker();
    await fireEvent.press(screen.getByRole('button', { name: 'Open rooms' }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenRooms).toHaveBeenCalledTimes(1);
  });
});
