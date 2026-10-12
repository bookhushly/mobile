import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { checkOut } from '@/features/receptionist/api/deskApi';
import { deskDb } from '@/features/receptionist/api/deskDb';
import type { BookingRow } from '@/features/receptionist/schemas/desk';
import { useShiftLog } from '@/features/receptionist/state/shiftLog';
import { CheckOutSheet } from '@/features/receptionist/ui/CheckOutSheet';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { booking, deskWrapper, HOTEL, makeQueryClient } from '../../hooks/__tests__/deskTestUtils';

// 2026-10-11 10:42 Lagos (09:42Z) by the server clock.
const mockNow = Date.parse('2026-10-11T09:42:00Z');
const NOW = mockNow;
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
jest.mock('@/features/receptionist/api/deskDb', () => ({ deskDb: { bookingById: jest.fn() } }));
jest.mock('@/features/receptionist/api/deskApi', () => ({ checkOut: jest.fn() }));
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

const mockById = jest.spyOn(deskDb, 'bookingById');
const mockCheckOut = jest.mocked(checkOut);

const ROOM = {
  id: 'r204',
  room_number: 204,
  floor: 2,
  status: 'occupied' as const,
  room_type_id: 'deluxe',
  hotel_room_types: { name: 'Deluxe' },
};
// In house since yesterday, booked until the 13th: leaving two days early.
const ADA = booking('b1', {
  guest_name: 'Ada Obi',
  booking_status: 'checked_in',
  checked_in: true,
  checked_in_at: '2026-10-10T13:00:00Z',
  check_in_date: '2026-10-10',
  check_out_date: '2026-10-13',
  hotel_rooms: ROOM,
});
const outRow = (at: string): BookingRow => ({
  ...ADA,
  booking_status: 'checked_out',
  checked_out_at: at,
});
const fail = (e: ApiError) => err(e);

async function renderSheet(b: BookingRow | null = ADA) {
  const qc = makeQueryClient();
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const onClose = jest.fn();
  const signOut = jest.fn();
  const Wrapper = deskWrapper(qc, { signOut });
  const r = await render(
    <Wrapper>
      <CheckOutSheet booking={b} onClose={onClose} />
    </Wrapper>,
  );
  return { ...r, qc, invalidate, onClose, signOut };
}

beforeEach(() => {
  jest.clearAllMocks();
  useShiftLog.getState().clear();
});

it('renders nothing without a booking', async () => {
  await renderSheet(null);
  expect(screen.queryByRole('header', { name: /Check out/ })).toBeNull();
});

it('confirm → Check out → done, with the dirty-room note, a log entry and a refetch', async () => {
  mockCheckOut.mockResolvedValue(ok({ success: true, hours_stayed: 20 }));
  const { invalidate, onClose } = await renderSheet();
  expect(screen.getByRole('header', { name: 'Check out Ada' })).toBeTruthy();
  expect(screen.getByText('Ada Obi')).toBeTruthy();
  expect(screen.getByText('Room 204 · Deluxe')).toBeTruthy();
  expect(screen.getByText('10–13 Oct · 3 nights')).toBeTruthy();
  expect(screen.getByText('Room 204 will be marked dirty.')).toBeTruthy();
  // R15: today is the 11th, the booking runs to the 13th.
  expect(screen.getByText('Booked until Tue 13 Oct — leaving 2 days early.')).toBeTruthy();

  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  expect(await screen.findByText('Checked out · Room 204 is now dirty')).toBeTruthy();
  expect(mockCheckOut).toHaveBeenCalledTimes(1);
  expect(mockCheckOut.mock.calls[0]?.[1]).toBe('b1');
  expect(useShiftLog.getState().entries).toEqual([
    { at: NOW, kind: 'checkOut', text: 'Checked out Ada Obi · Room 204' },
  ]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] });
  expect(mockCue).toHaveBeenCalledWith('success');
  await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('no early banner and no dirty-room line when leaving on the day without a room', async () => {
  await renderSheet({ ...ADA, check_out_date: '2026-10-11', hotel_rooms: null });
  expect(screen.queryByText(/will be marked dirty/)).toBeNull();
  expect(screen.queryByText(/early/)).toBeNull();
  expect(screen.getByText('No room yet')).toBeTruthy();
});

it('a timeout is uncertain; Check again re-reads and finishes when the check-out is there', async () => {
  mockCheckOut.mockResolvedValue(fail({ kind: 'timeout' }));
  await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  expect(
    await screen.findByText("Couldn't confirm the check-out. It may have gone through."),
  ).toBeTruthy();
  // Not there yet: back to the confirm, nothing re-posted by itself.
  mockById.mockResolvedValueOnce(ok(ADA));
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(
    await screen.findByText("The check-out hasn't gone through yet. You can try again."),
  ).toBeTruthy();
  expect(mockCheckOut).toHaveBeenCalledTimes(1);
  // The second attempt also times out, but the re-read finds it done (at our send time).
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  await screen.findByText("Couldn't confirm the check-out. It may have gone through.");
  mockById.mockResolvedValueOnce(ok(outRow('2026-10-11T09:42:05Z')));
  await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
  expect(await screen.findByText('Checked out · Room 204 is now dirty')).toBeTruthy();
  expect(mockById).toHaveBeenCalledWith(HOTEL, 'b1');
  expect(mockCheckOut).toHaveBeenCalledTimes(2);
  expect(useShiftLog.getState().entries).toHaveLength(1);
});

it('closing after an uncertain answer refetches the desk (it may have gone through)', async () => {
  mockCheckOut.mockResolvedValue(fail({ kind: 'network' }));
  const { invalidate, onClose } = await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  await screen.findByText("Couldn't confirm the check-out. It may have gone through.");
  expect(invalidate).not.toHaveBeenCalled();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] });
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('closing before anything was sent does not refetch', async () => {
  const { invalidate, onClose } = await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
  expect(invalidate).not.toHaveBeenCalled();
});

it('409 already_checked_out after our send is re-read: someone else did it earlier', async () => {
  mockCheckOut.mockResolvedValue(fail({ kind: 'conflict', code: 'already_checked_out' }));
  mockById.mockResolvedValue(ok(outRow('2026-10-11T08:15:00Z')));
  const { invalidate } = await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  expect(
    await screen.findByText('Already checked out at 09:15 (by another desk or device).'),
  ).toBeTruthy();
  expect(mockById).toHaveBeenCalledTimes(1);
  expect(useShiftLog.getState().entries).toEqual([]);
  expect(invalidate).toHaveBeenCalledWith({ queryKey: ['desk', HOTEL] });
  expect(screen.getByRole('button', { name: 'Done' })).toBeTruthy();
  // Settled: no future-tense room line, no early-leave note.
  expect(screen.queryByText(/will be marked dirty/)).toBeNull();
  expect(screen.queryByText(/leaving 2 days early/)).toBeNull();
});

it('409 already_checked_out that the re-read shows as ours is a plain success', async () => {
  mockCheckOut.mockResolvedValue(fail({ kind: 'conflict', code: 'already_checked_out' }));
  mockById.mockResolvedValue(ok(outRow('2026-10-11T09:41:30Z')));
  await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  expect(await screen.findByText('Checked out · Room 204 is now dirty')).toBeTruthy();
});

it('a 400 not_checked_in is a refusal in words', async () => {
  mockCheckOut.mockResolvedValue(fail({ kind: 'unknown', status: 400, code: 'not_checked_in' }));
  await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  expect(await screen.findByText("This guest isn't checked in.")).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Check out' })).toBeNull();
  expect(screen.queryByText(/will be marked dirty/)).toBeNull();
  expect(screen.queryByText(/leaving 2 days early/)).toBeNull();
  expect(screen.getByText('Room 204 · Deluxe')).toBeTruthy();
  expect(mockCue).toHaveBeenCalledWith('error');
});

it('429 is neutral and holds the button for the countdown', async () => {
  mockCheckOut.mockResolvedValue(fail({ kind: 'rateLimited', retryAfterSec: 12 }));
  await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  expect(
    await screen.findByText(
      "This hotel's network is sending too many requests — try again in 12 s.",
    ),
  ).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Check out' })).toBeDisabled();
});

it('two quick presses send one request', async () => {
  let answer: (v: ReturnType<typeof fail>) => void = () => undefined;
  mockCheckOut.mockReturnValue(
    new Promise((resolve) => {
      answer = resolve;
    }),
  );
  await renderSheet();
  const button = screen.getByRole('button', { name: 'Check out' });
  await fireEvent.press(button);
  await fireEvent.press(button);
  expect(mockCheckOut).toHaveBeenCalledTimes(1);
  answer(fail({ kind: 'forbidden' }));
  expect(await screen.findByText("You can't check out guests at this hotel.")).toBeTruthy();
});

it('a 401 after refresh signs out', async () => {
  mockCheckOut.mockResolvedValue(fail({ kind: 'auth' }));
  const { signOut } = await renderSheet();
  await fireEvent.press(screen.getByRole('button', { name: 'Check out' }));
  await waitFor(() => {
    expect(signOut).toHaveBeenCalledTimes(1);
  });
  expect(useShiftLog.getState().entries).toEqual([]);
});
