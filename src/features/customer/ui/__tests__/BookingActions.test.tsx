import { fireEvent, screen, within } from '@testing-library/react-native';

import { cancelBooking, requestRefund } from '@/features/customer/api/bookingActionsApi';
import { unsettled } from '@/features/customer/hooks/unsettled';
import type { ApiError } from '@/shared/lib/errors';
import type { memoryKv } from '@/shared/lib/kv';
import { err, ok } from '@/shared/lib/result';

import { ap, ev, ho, USER } from '../../hooks/__tests__/customerTestUtils';
import { pastEvent, rowNames, showActions, type DbMock } from './actionsKit';

jest.mock('@/shared/api/instance', () => ({
  api: {},
  clock: { serverNow: () => Date.parse('2026-10-13T11:00:00Z') },
}));
jest.mock('@/features/customer/api/bookingActionsApi', () => ({
  cancelBooking: jest.fn(),
  requestRefund: jest.fn(),
  transferTickets: jest.fn(),
}));
jest.mock('@/features/customer/api/reviewsApi', () => ({ postReview: jest.fn() }));
jest.mock('@/features/customer/api/customerDb', () => ({
  customerDb: { event: jest.fn(), hotel: jest.fn(), apartment: jest.fn() },
}));
jest.mock('@/features/customer/offline/wallet', () => ({ wallet: { drop: jest.fn() } }));
jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));
jest.mock('@/shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id: 'u1' } } } }),
    },
  },
}));

const cancelMock = jest.mocked(cancelBooking);
const refundMock = jest.mocked(requestRefund);
const db = jest.requireMock<{ customerDb: DbMock }>(
  '@/features/customer/api/customerDb',
).customerDb;
const timeout = err<ApiError>({ kind: 'timeout' });

// The marks (reviewed, refund requested) live in this in-memory store: empty it per test, or a
// mark written late by one test shows up in the next.
const mockKv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;

beforeEach(async () => {
  for (const k of Object.keys(mockKv.dump())) await mockKv.delete(k);
  jest.clearAllMocks();
  unsettled.clearAll();
});

const futureHotel = { check_in_date: '2026-10-20', check_out_date: '2026-10-22' };

async function openCancel() {
  await fireEvent.press(screen.getByRole('button', { name: 'Cancel booking' }));
}
async function confirmCancel() {
  await fireEvent.press(
    within(screen.getByTestId('cancel-sheet')).getByRole('button', { name: 'Cancel booking' }),
  );
}

describe('Manage booking', () => {
  it('lists only the allowed actions, Cancel last', async () => {
    const r = await showActions({ kind: 'event', row: ev() });
    expect(rowNames()).toEqual(['Transfer tickets', 'Ask for a refund', 'Cancel booking']);
    await r.unmount();
  });

  it('a past event offers only a review; a stay checked in today offers nothing', async () => {
    const r = await showActions({
      kind: 'event',
      row: pastEvent(),
    });
    expect(rowNames()).toEqual(['Write a review']);
    await r.unmount();
    const h = await showActions({ kind: 'hotel', row: ho() });
    expect(screen.queryByTestId('manage-booking')).toBeNull();
    await h.unmount();
  });
});

describe('Cancel sheet', () => {
  it.each([
    [
      'an unpaid event',
      { kind: 'event', row: ev({ status: 'pending', payment_status: 'pending' }) },
      'You haven’t paid, so nothing is charged.',
    ],
    [
      'a paid hotel',
      { kind: 'hotel', row: ho(futureHotel) },
      'A full refund will be sent to your payment method.',
    ],
    [
      'a paid apartment',
      { kind: 'apartment', row: ap({ ...futureHotel, booking_status: 'confirmed' }) },
      'We’ll refund you if the payment can be reversed.',
    ],
  ] as const)('%s shows its money line', async (_name, target, line) => {
    const r = await showActions(target);
    await openCancel();
    expect(screen.getByText(line)).toBeTruthy();
    expect(screen.getByText('This can’t be undone.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Keep booking' })).toBeTruthy();
    await r.unmount();
  });

  it('done: the server’s refund answer in words', async () => {
    cancelMock.mockResolvedValue(ok({ refunded: true, refundMessage: 'raw provider text' }));
    const r = await showActions({ kind: 'hotel', row: ho(futureHotel) });
    await openCancel();
    await confirmCancel();
    expect(await screen.findByText('Booking cancelled')).toBeTruthy();
    expect(
      screen.getByText('Your refund has been started. It goes back to your payment method.'),
    ).toBeTruthy();
    expect(screen.queryByText('raw provider text')).toBeNull();
    await r.unmount();
  });

  it('a refusal reads in words, with no way to re-send', async () => {
    cancelMock.mockResolvedValue(err({ kind: 'conflict', code: 'event_passed' }));
    const r = await showActions({ kind: 'event', row: ev() });
    await openCancel();
    await confirmCancel();
    expect(
      await screen.findByText('This event has already started, so it can’t be cancelled.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to booking' })).toBeTruthy();
    await r.unmount();
  });

  it('a lost answer, then a re-read showing cancelled: "Booking cancelled", no refund words', async () => {
    cancelMock.mockResolvedValue(timeout);
    db.event.mockResolvedValue(ok(ev({ status: 'cancelled' })));
    const r = await showActions({ kind: 'event', row: ev() });
    await openCancel();
    await confirmCancel();
    expect(await screen.findByText('Booking cancelled')).toBeTruthy();
    expect(within(screen.getByTestId('cancel-sheet')).queryByText(/refund/i)).toBeNull();
    expect(screen.queryByText(/Couldn’t cancel/)).toBeNull();
    await r.unmount();
  });

  it('a lost answer with the booking unchanged: Check again re-reads, never re-posts', async () => {
    cancelMock.mockResolvedValue(timeout);
    db.event.mockResolvedValueOnce(ok(ev())).mockResolvedValueOnce(ok(ev({ status: 'cancelled' })));
    const r = await showActions({ kind: 'event', row: ev() });
    await openCancel();
    await confirmCancel();
    expect(
      await screen.findByText(
        'We couldn’t confirm whether your booking was cancelled. Check again.',
      ),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    expect(await screen.findByText('Booking cancelled')).toBeTruthy();
    expect(cancelMock).toHaveBeenCalledTimes(1);
    await r.unmount();
  });

  it('an unsettled cancel opens on Check again', async () => {
    unsettled.set(USER, 'event', 'e1', {
      action: 'cancel',
      sentAt: Date.now(),
      email: null,
      answered: false,
    });
    db.event.mockResolvedValue(ok(ev()));
    const r = await showActions({ kind: 'event', row: ev() });
    await openCancel();
    expect(
      screen.getByText('We couldn’t confirm whether your booking was cancelled. Check again.'),
    ).toBeTruthy();
    expect(
      within(screen.getByTestId('cancel-sheet')).queryByRole('button', { name: 'Cancel booking' }),
    ).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Check again' }));
    expect(db.event).toHaveBeenCalledWith(USER, 'e1');
    expect(cancelMock).not.toHaveBeenCalled();
    await r.unmount();
  });
});

describe('Refund sheet', () => {
  it('an empty reason never reaches the server', async () => {
    const r = await showActions({ kind: 'event', row: ev() });
    await fireEvent.press(screen.getByRole('button', { name: 'Ask for a refund' }));
    await fireEvent.changeText(screen.getByTestId('refund-reason'), '   ');
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(screen.getByText('Tell the organiser why you’re asking for a refund.')).toBeTruthy();
    expect(refundMock).not.toHaveBeenCalled();
    await r.unmount();
  });

  it('sent: the request reads as sent and the row as requested', async () => {
    refundMock.mockResolvedValue(ok({ id: 'rr1' }));
    const r = await showActions({ kind: 'event', row: ev() });
    await fireEvent.press(screen.getByRole('button', { name: 'Ask for a refund' }));
    await fireEvent.changeText(screen.getByTestId('refund-reason'), '  I can’t attend  ');
    expect(screen.getByText('18 / 500')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Request sent')).toBeTruthy();
    expect(refundMock).toHaveBeenCalledWith({}, 'e1', 'I can’t attend');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByLabelText('Refund requested')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Ask for a refund' })).toBeNull();
    await r.unmount();
  });

  it('a duplicate (409) reads as already asked, not an error', async () => {
    refundMock.mockResolvedValue(err({ kind: 'conflict', code: 'conflict' }));
    const r = await showActions({ kind: 'event', row: ev() });
    await fireEvent.press(screen.getByRole('button', { name: 'Ask for a refund' }));
    await fireEvent.changeText(screen.getByTestId('refund-reason'), 'Change of plans');
    await fireEvent.press(screen.getByRole('button', { name: 'Send request' }));
    expect(
      await screen.findByText('You’ve already asked for a refund for this booking.'),
    ).toBeTruthy();
    expect(screen.getByRole('header', { name: 'Refund requested' })).toBeTruthy();
    await r.unmount();
  });
});
