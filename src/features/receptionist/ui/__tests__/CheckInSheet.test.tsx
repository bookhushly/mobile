import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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

// The camera stub: a button that "scans" mockCamera.raw; the prompt renders its copy.
const mockCamera = { raw: 'AB12CD34', permission: 'granted' as string, mounts: 0 };
jest.mock('@/shared/ui/camera', () => {
  const { Pressable, Text: RNText } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    QrCamera: ({ onCode }: { onCode: (raw: string) => void }) => {
      mockCamera.mounts += 1;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="fake-camera"
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
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const onClose = jest.fn();
  const signOut = jest.fn();
  const Wrapper = deskWrapper(qc, { signOut });
  const r = await render(
    <Wrapper>
      <CheckInSheet visible request={{ id: 1, code }} onClose={onClose} />
    </Wrapper>,
  );
  return { ...r, qc, invalidate, onClose, signOut };
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

beforeEach(() => {
  jest.clearAllMocks();
  mockNow = NOW;
  mockCamera.raw = 'AB12CD34';
  mockCamera.permission = 'granted';
  mockCamera.mounts = 0;
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
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] });
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
  await fireEvent.press(screen.getByRole('button', { name: 'Move' }));
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
  mockRooms.mockResolvedValue(ok([{ ...ROOM, id: 'r305', room_number: 305, last_cleaned_at: null }]));
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
  mockRooms.mockResolvedValue(ok([{ ...ROOM, id: 'r305', room_number: 305, last_cleaned_at: null }]));
  mockReassign.mockResolvedValue(fail({ kind: 'auth' }));
  const { signOut } = await renderSheet();
  await toPreview();
  await fireEvent.press(screen.getByRole('button', { name: 'Check in' }));
  await fireEvent.press(await screen.findByRole('button', { name: 'Choose another room' }));
  await fireEvent.press(await screen.findByRole('button', { name: /Room 305/ }));
  await fireEvent.press(screen.getByRole('button', { name: 'Move' }));
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
  // The sheet ticks on the server clock (real 1 s interval here).
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
