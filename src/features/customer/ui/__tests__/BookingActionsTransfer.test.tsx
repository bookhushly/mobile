import { act, fireEvent, screen, waitFor, within } from '@testing-library/react-native';
import { Platform } from 'react-native';

import { transferTickets } from '@/features/customer/api/bookingActionsApi';
import { postReview } from '@/features/customer/api/reviewsApi';
import { sentNotice } from '@/features/customer/hooks/sentNotice';
import { unsettled } from '@/features/customer/hooks/unsettled';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { ev } from '../../hooks/__tests__/customerTestUtils';
import { ME, pastEvent, rowNames, showActions, type DbMock } from './actionsKit';

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

// Records the transfer sheet's iOS dismissal callback (see the iPhone test).
const mockDismissed: { transfer?: () => void } = {};
jest.mock('@/shared/ui/Sheet', () => {
  const { createElement } = jest.requireActual<typeof import('react')>('react');
  const actual = jest.requireActual<typeof import('@/shared/ui/Sheet')>('@/shared/ui/Sheet');
  return {
    Sheet: (props: Parameters<typeof actual.Sheet>[0]) => {
      if (props.testID === 'transfer-sheet') mockDismissed.transfer = props.onDismissed;
      return createElement(actual.Sheet, props);
    },
  };
});

const transferMock = jest.mocked(transferTickets);
const reviewMock = jest.mocked(postReview);
const db = jest.requireMock<{ customerDb: DbMock }>(
  '@/features/customer/api/customerDb',
).customerDb;

beforeEach(() => {
  jest.clearAllMocks();
  unsettled.clearAll();
  sentNotice.clear();
});

const sheet = () => within(screen.getByTestId('transfer-sheet'));

async function toReview(email: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Transfer tickets' }));
  await fireEvent.changeText(screen.getByTestId('transfer-email'), email);
  await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
}

describe('Transfer sheet', () => {
  it('refuses the user’s own email and a bad address before any call', async () => {
    const r = await showActions({ kind: 'event', row: ev() });
    await toReview('  ME@Example.com ');
    expect(
      screen.getByText('That’s your own email. Enter the email of who you’re sending to.'),
    ).toBeTruthy();
    await fireEvent.changeText(screen.getByTestId('transfer-email'), 'bola@');
    await fireEvent.press(screen.getByRole('button', { name: 'Continue' }));
    expect(screen.getByText('Enter a valid email address.')).toBeTruthy();
    expect(transferMock).not.toHaveBeenCalled();
    expect(ME).toBe('me@example.com');
    expect(screen.getByTestId('transfer-email').props.maxLength).toBe(254);
    await r.unmount();
  });

  it('two steps: the email, then a review with what is sent and to whom; Back returns', async () => {
    const r = await showActions({ kind: 'event', row: ev() });
    await toReview('Bola@Example.com');
    expect(screen.getByRole('header', { name: 'Check before you send' })).toBeTruthy();
    expect(screen.getByText('1 ticket')).toBeTruthy();
    expect(screen.getByTestId('transfer-to')).toHaveTextContent('bola@example.com');
    expect(screen.getByText('You’ll lose these tickets. This can’t be undone.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByTestId('transfer-email')).toBeTruthy();
    expect(transferMock).not.toHaveBeenCalled();
    await r.unmount();
  });

  it('Android: sent → leaves the booking at once and Bookings says where they went', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    transferMock.mockResolvedValue(ok({ transferredTo: 'bola@example.com' }));
    const r = await showActions({ kind: 'event', row: ev() });
    await toReview('bola@example.com');
    await fireEvent.press(sheet().getByRole('button', { name: 'Transfer tickets' }));
    await waitFor(() => {
      expect(r.onTransferred).toHaveBeenCalledTimes(1);
    });
    expect(transferMock).toHaveBeenCalledWith({}, 'e1', 'bola@example.com');
    expect(sentNotice.get()).toBe('Tickets sent to b•••a@example.com');
    await r.unmount();
    expect(r.onTransferred).toHaveBeenCalledTimes(1);
  });

  it('iPhone: leaves only once the sheet has slid away', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    transferMock.mockResolvedValue(ok({ transferredTo: 'bola@example.com' }));
    const r = await showActions({ kind: 'event', row: ev() });
    await toReview('bola@example.com');
    await fireEvent.press(sheet().getByRole('button', { name: 'Transfer tickets' }));
    await waitFor(() => {
      expect(sentNotice.get()).not.toBeNull();
    });
    expect(r.onTransferred).not.toHaveBeenCalled();
    // The RN Modal mock renders nothing once hidden, so its dismissal is fired directly.
    await act(() => {
      mockDismissed.transfer?.();
    });
    expect(r.onTransferred).toHaveBeenCalledTimes(1);
    await r.unmount();
  });

  it('a lost answer, then the booking no longer readable: tickets sent (review focus 2)', async () => {
    jest.replaceProperty(Platform, 'OS', 'android');
    transferMock.mockResolvedValue(err<ApiError>({ kind: 'timeout' }));
    db.event.mockResolvedValue(ok(null));
    const r = await showActions({ kind: 'event', row: ev() });
    await toReview('bola@example.com');
    await fireEvent.press(sheet().getByRole('button', { name: 'Transfer tickets' }));
    await waitFor(() => {
      expect(r.onTransferred).toHaveBeenCalledTimes(1);
    });
    expect(sentNotice.get()).toBe('Tickets sent to b•••a@example.com');
    expect(transferMock).toHaveBeenCalledTimes(1);
    await r.unmount();
  });

  it('a refusal (400) reads in words', async () => {
    transferMock.mockResolvedValue(err<ApiError>({ kind: 'unknown', status: 400 }));
    const r = await showActions({ kind: 'event', row: ev() });
    await toReview('bola@example.com');
    await fireEvent.press(sheet().getByRole('button', { name: 'Transfer tickets' }));
    expect(await screen.findByText('These tickets can’t be sent to that address right now.')).toBeTruthy();
    expect(r.onTransferred).not.toHaveBeenCalled();
    await r.unmount();
  });
});

async function writeReview(stars: string, comment: string) {
  await fireEvent.press(screen.getByRole('button', { name: 'Write a review' }));
  await fireEvent.press(screen.getByRole('radio', { name: stars }));
  await fireEvent.changeText(screen.getByTestId('review-comment'), comment);
  await fireEvent.press(screen.getByRole('button', { name: 'Post review' }));
}

describe('Review sheet', () => {
  it('needs a rating and 10 characters before posting', async () => {
    const r = await showActions({ kind: 'event', row: pastEvent() });
    await fireEvent.press(screen.getByRole('button', { name: 'Write a review' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Post review' }));
    expect(screen.getByText('Choose a rating.')).toBeTruthy();
    expect(screen.getByText('Write at least 10 characters.')).toBeTruthy();
    expect(reviewMock).not.toHaveBeenCalled();
    await r.unmount();
  });

  it('posted: thanks, and the row reads Reviewed', async () => {
    reviewMock.mockResolvedValue(ok({ id: 'rv1' }));
    const r = await showActions({ kind: 'event', row: pastEvent() });
    await writeReview('5 of 5, Excellent', '  Great night out!  ');
    expect(await screen.findByText('Thanks — your review is live')).toBeTruthy();
    expect(reviewMock).toHaveBeenCalledWith({}, 'l1', 'event', 5, 'Great night out!');
    await fireEvent.press(screen.getByRole('button', { name: 'Done' }));
    expect(await screen.findByLabelText('Reviewed')).toBeTruthy();
    expect(rowNames()).toEqual([]);
    await r.unmount();
  });

  it('already reviewed (409) is a done state, not an error', async () => {
    reviewMock.mockResolvedValue(err({ kind: 'conflict', code: 'already_reviewed' }));
    const r = await showActions({ kind: 'event', row: pastEvent() });
    await writeReview('3 of 5, Good', 'It was a good night');
    expect(await screen.findByText('You’ve already reviewed this.')).toBeTruthy();
    await r.unmount();
  });

  it('not eligible (403) says when they can review', async () => {
    reviewMock.mockResolvedValue(err({ kind: 'forbidden', code: 'no_completed_booking' }));
    const r = await showActions({ kind: 'event', row: pastEvent() });
    await writeReview('2 of 5, Fair', 'It was an okay night');
    expect(await screen.findByText('You can review after your stay or event.')).toBeTruthy();
    await r.unmount();
  });
});
