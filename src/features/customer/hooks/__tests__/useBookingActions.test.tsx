import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import {
  cancelBooking,
  requestRefund,
  transferTickets,
} from '@/features/customer/api/bookingActionsApi';
import { customerDb } from '@/features/customer/api/customerDb';
import { postReview } from '@/features/customer/api/reviewsApi';
import {
  useCancelBooking,
  usePostReview,
  useRefundRequest,
  useTransferTickets,
} from '@/features/customer/hooks/useBookingActions';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { unsettled } from '@/features/customer/hooks/unsettled';
import { wallet } from '@/features/customer/offline/wallet';
import type { memoryKv } from '@/shared/lib/kv';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { ap, ev, ho, makeQueryClient, USER, wrapper } from './customerTestUtils';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => Date.now() } }));
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
const mockKv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;
let mockSessionUser: string | null = 'u1';
jest.mock('@/shared/supabase/client', () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: mockSessionUser === null ? null : { user: { id: mockSessionUser } } },
        }),
    },
  },
}));

const cancelMock = jest.mocked(cancelBooking);
const refundMock = jest.mocked(requestRefund);
const transferMock = jest.mocked(transferTickets);
const reviewMock = jest.mocked(postReview);
type Db = typeof customerDb;
const db = jest.requireMock<{
  customerDb: {
    event: jest.MockedFunction<Db['event']>;
    hotel: jest.MockedFunction<Db['hotel']>;
    apartment: jest.MockedFunction<Db['apartment']>;
  };
}>('@/features/customer/api/customerDb').customerDb;
const drop = jest.requireMock<{
  wallet: { drop: jest.MockedFunction<(typeof wallet)['drop']> };
}>('@/features/customer/offline/wallet').wallet.drop;

const timeout = err<ApiError>({ kind: 'timeout' });

function deferred<T>() {
  let resolve: (v: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

let qc: QueryClient;
beforeEach(async () => {
  jest.clearAllMocks();
  mockSessionUser = USER;
  qc = makeQueryClient();
  drop.mockResolvedValue(undefined);
  unsettled.clearAll();
  for (const k of Object.keys(mockKv.dump())) await mockKv.delete(k);
});
afterEach(() => {
  qc.clear();
});

const opts = () => ({ wrapper: wrapper(qc) });

describe('useCancelBooking', () => {
  it('done: shows the server’s refund answer and refreshes the booking and the list', async () => {
    cancelMock.mockResolvedValue(ok({ refunded: true, refundMessage: null }));
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'hotel', 'h1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(cancelMock).toHaveBeenCalledWith({}, 'hotel', 'h1');
    expect(result.current.state).toEqual({
      kind: 'done',
      value: { refunded: true, refundMessage: null },
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    expect(spy).toHaveBeenCalledWith({ queryKey: customerKeys.booking(USER, 'hotel', 'h1') });
    expect(db.hotel).not.toHaveBeenCalled();
    await unmount();
  });

  it('a refusal reads in words and re-reads nothing', async () => {
    cancelMock.mockResolvedValue(err({ kind: 'conflict', code: 'booking_changed' }));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'event', 'e1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: 'refused', reason: 'bookingChanged' });
    expect(db.event).not.toHaveBeenCalled();
    await unmount();
  });

  it('a lost answer, then a re-read showing cancelled, reads as cancelled (review focus 1)', async () => {
    cancelMock.mockResolvedValue(timeout);
    db.event.mockResolvedValue(ok(ev({ status: 'cancelled' })));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'event', 'e1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(db.event).toHaveBeenCalledWith(USER, 'e1');
    expect(result.current.state).toEqual({ kind: 'done', value: null });
    expect(cancelMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('a lost answer with the booking unchanged stays uncertain; Check again re-reads only', async () => {
    cancelMock.mockResolvedValue(timeout);
    db.apartment
      .mockResolvedValueOnce(ok(ap({ booking_status: 'confirmed' })))
      .mockResolvedValueOnce(err({ kind: 'network' }))
      .mockResolvedValueOnce(ok(ap({ booking_status: 'cancelled' })));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'apartment', 'a1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    await act(async () => {
      await result.current.recheck();
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    await act(async () => {
      await result.current.recheck();
    });
    expect(result.current.state).toEqual({ kind: 'done', value: null });
    expect(cancelMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('shows checking while it re-reads a hotel booking', async () => {
    cancelMock.mockResolvedValue(timeout);
    const read = deferred<Awaited<ReturnType<typeof customerDb.hotel>>>();
    db.hotel.mockReturnValue(read.promise);
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'hotel', 'h1'),
      opts(),
    );
    let p: Promise<unknown> = Promise.resolve();
    await act(async () => {
      p = result.current.cancel();
      await Promise.resolve();
    });
    await waitFor(() => {
      expect(result.current.state).toEqual({ kind: 'checking' });
    });
    await act(async () => {
      read.resolve(ok(ho({ booking_status: 'cancelled' })));
      await p;
    });
    expect(result.current.state).toEqual({ kind: 'done', value: null });
    await unmount();
  });

  it('is single-flight: a second tap while sending posts nothing', async () => {
    const answer = deferred<Awaited<ReturnType<typeof cancelBooking>>>();
    cancelMock.mockReturnValue(answer.promise);
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'event', 'e1'),
      opts(),
    );
    let first: Promise<unknown> = Promise.resolve();
    let second: unknown = 'unset';
    await act(async () => {
      first = result.current.cancel();
      second = await result.current.cancel();
    });
    expect(second).toBeNull();
    expect(result.current.state).toEqual({ kind: 'sending' });
    await act(async () => {
      answer.resolve(ok({ refunded: false, refundMessage: null }));
      await first;
    });
    expect(cancelMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('429 is a neutral rate limit, 401 is signed out', async () => {
    cancelMock
      .mockResolvedValueOnce(err({ kind: 'rateLimited', retryAfterSec: 30 }))
      .mockResolvedValueOnce(err({ kind: 'auth' }));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'event', 'e1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: 'rateLimited', retryAfterSec: 30 });
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: 'signedOut' });
    expect(db.event).not.toHaveBeenCalled();
    await act(() => {
      result.current.reset();
    });
    expect(result.current.state).toEqual({ kind: 'idle' });
    await unmount();
  });
});

describe('unsettled actions only re-check (review 3)', () => {
  it('cancel: uncertain → sheet closed → tapped again → no second POST; the re-read decides', async () => {
    cancelMock.mockResolvedValue(timeout);
    db.event
      .mockResolvedValueOnce(ok(ev({ status: 'confirmed' })))
      .mockResolvedValueOnce(ok(ev({ status: 'cancelled' })));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'event', 'e1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    await act(() => {
      result.current.reset();
    });
    await act(async () => {
      await result.current.cancel();
    });
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(db.event).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({ kind: 'done', value: null });
    // Settled: a later cancel posts again.
    expect(unsettled.get(USER, 'event', 'e1')).toBeNull();
    await unmount();
  });

  it('cancel: the latch outlives the hook (sheet unmounted and reopened)', async () => {
    cancelMock.mockResolvedValue(err({ kind: 'network' }));
    db.hotel.mockResolvedValue(ok(ho({ booking_status: 'confirmed' })));
    const first = await renderHook(() => useCancelBooking(USER, 'hotel', 'h1'), opts());
    await act(async () => {
      await first.result.current.cancel();
    });
    await first.unmount();
    const again = await renderHook(() => useCancelBooking(USER, 'hotel', 'h1'), opts());
    await act(async () => {
      await again.result.current.cancel();
    });
    expect(cancelMock).toHaveBeenCalledTimes(1);
    expect(again.result.current.state).toEqual({ kind: 'uncertain' });
    // Another booking is not latched.
    const other = await renderHook(() => useCancelBooking(USER, 'hotel', 'h2'), opts());
    await act(async () => {
      await other.result.current.cancel();
    });
    expect(cancelMock).toHaveBeenCalledTimes(2);
    await again.unmount();
    await other.unmount();
  });

  it('a refusal or a rate limit settles the latch', async () => {
    cancelMock
      .mockResolvedValueOnce(err({ kind: 'rateLimited', retryAfterSec: 5 }))
      .mockResolvedValueOnce(err({ kind: 'conflict', code: 'not_cancellable' }))
      .mockResolvedValueOnce(err({ kind: 'conflict', code: 'not_cancellable' }));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'event', 'e1'),
      opts(),
    );
    for (let i = 0; i < 3; i += 1) {
      await act(async () => {
        await result.current.cancel();
      });
    }
    expect(cancelMock).toHaveBeenCalledTimes(3);
    expect(db.event).not.toHaveBeenCalled();
    await unmount();
  });

  it('transfer: a fresh sheet re-reads only, and reports the address first sent to', async () => {
    transferMock.mockResolvedValue(timeout);
    db.event.mockResolvedValueOnce(ok(ev())).mockResolvedValueOnce(ok(null));
    const first = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await first.result.current.transfer('B@x.com');
    });
    expect(first.result.current.state).toEqual({ kind: 'uncertain' });
    await first.unmount();
    const again = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await again.result.current.transfer('someone-else@x.com');
    });
    expect(transferMock).toHaveBeenCalledTimes(1);
    expect(again.result.current.state).toEqual({
      kind: 'done',
      value: { transferredTo: 'b@x.com' },
    });
    await again.unmount();
  });

  it('transfer: a re-read showing nothing after sign-out is not success', async () => {
    transferMock.mockResolvedValue(timeout);
    db.event.mockResolvedValue(ok(null));
    mockSessionUser = null;
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer('b@x.com');
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    expect(drop).not.toHaveBeenCalled();
    await unmount();
  });
});

describe('the latch settles once the answer can no longer land (final review I2, K1)', () => {
  it('cancel: a 5xx answer and the booking unchanged → not cancelled, and a new POST is allowed', async () => {
    cancelMock
      .mockResolvedValueOnce(err({ kind: 'unavailable', status: 500, code: 'cancel_failed' }))
      .mockResolvedValueOnce(ok({ refunded: false, refundMessage: null }));
    db.hotel.mockResolvedValue(ok(ho({ booking_status: 'confirmed' })));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'hotel', 'h1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: 'notDone' });
    expect(unsettled.get(USER, 'hotel', 'h1')).toBeNull();
    await act(async () => {
      await result.current.cancel();
    });
    expect(cancelMock).toHaveBeenCalledTimes(2);
    expect(result.current.state).toEqual({
      kind: 'done',
      value: { refunded: false, refundMessage: null },
    });
    await unmount();
  });

  it('cancel: a timeout keeps the latch while the answer may land, then settles as not done', async () => {
    jest.useFakeTimers({ now: Date.parse('2026-10-13T11:00:00Z') });
    try {
      cancelMock.mockResolvedValue(timeout);
      db.event.mockResolvedValue(ok(ev({ status: 'confirmed' })));
      const { result, unmount } = await renderHook(
        () => useCancelBooking(USER, 'event', 'e1'),
        opts(),
      );
      await act(async () => {
        await result.current.cancel();
      });
      expect(result.current.state).toEqual({ kind: 'uncertain' });
      jest.setSystemTime(Date.parse('2026-10-13T11:00:45Z'));
      await act(async () => {
        await result.current.recheck();
      });
      expect(result.current.state).toEqual({ kind: 'uncertain' });
      jest.setSystemTime(Date.parse('2026-10-13T11:00:46Z'));
      await act(async () => {
        await result.current.recheck();
      });
      expect(result.current.state).toEqual({ kind: 'notDone' });
      expect(unsettled.get(USER, 'event', 'e1')).toBeNull();
      expect(cancelMock).toHaveBeenCalledTimes(1);
      await unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('cancel: a failed re-read never settles as not done', async () => {
    cancelMock.mockResolvedValue(err({ kind: 'unavailable', status: 500 }));
    db.event.mockResolvedValue(err({ kind: 'network' }));
    const { result, unmount } = await renderHook(
      () => useCancelBooking(USER, 'event', 'e1'),
      opts(),
    );
    await act(async () => {
      await result.current.cancel();
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    expect(unsettled.get(USER, 'event', 'e1')).not.toBeNull();
    await unmount();
  });

  it('transfer: a 5xx answer and the booking still yours → not sent, the wallet untouched', async () => {
    transferMock.mockResolvedValue(err({ kind: 'unavailable', status: 500 }));
    db.event.mockResolvedValue(ok(ev()));
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer('b@x.com');
    });
    expect(result.current.state).toEqual({ kind: 'notDone' });
    expect(unsettled.get(USER, 'event', 'e1')).toBeNull();
    expect(drop).not.toHaveBeenCalled();
    await unmount();
  });

  it('transfer: an address the client won’t send never sets the latch (minor 6)', async () => {
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer('not-an-email');
    });
    expect(result.current.state).toEqual({ kind: 'refused', reason: 'invalid' });
    expect(unsettled.get(USER, 'event', 'e1')).toBeNull();
    expect(transferMock).not.toHaveBeenCalled();
    await unmount();
  });
});

describe('useTransferTickets', () => {
  it('done: drops the tickets from the device and reloads the list', async () => {
    transferMock.mockResolvedValue(ok({ transferredTo: 'b@x.com' }));
    qc.setQueryData(customerKeys.booking(USER, 'event', 'e1'), { row: ev() });
    qc.setQueryData(customerKeys.wallet(USER), { savedAt: 1, entries: [] });
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer('b@x.com');
    });
    expect(transferMock).toHaveBeenCalledWith({}, 'e1', 'b@x.com');
    expect(result.current.state).toEqual({ kind: 'done', value: { transferredTo: 'b@x.com' } });
    expect(drop).toHaveBeenCalledWith(USER, 'event', 'e1');
    expect(qc.getQueryData(customerKeys.booking(USER, 'event', 'e1'))).toBeUndefined();
    expect(qc.getQueryData(customerKeys.wallet(USER))).toBeUndefined();
    expect(spy).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    await unmount();
  });

  it('a lost answer, then the booking no longer readable, reads "Tickets sent" (review focus 2)', async () => {
    transferMock.mockResolvedValue(timeout);
    db.event.mockResolvedValue(ok(null));
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer(' B@X.com ');
    });
    expect(result.current.state).toEqual({ kind: 'done', value: { transferredTo: 'b@x.com' } });
    expect(drop).toHaveBeenCalled();
    expect(transferMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('a lost answer with the booking still here (or unreadable) stays uncertain', async () => {
    transferMock.mockResolvedValue(err({ kind: 'network' }));
    db.event.mockResolvedValueOnce(ok(ev())).mockResolvedValueOnce(err({ kind: 'network' }));
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer('b@x.com');
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    await act(async () => {
      await result.current.recheck();
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    expect(drop).not.toHaveBeenCalled();
    expect(transferMock).toHaveBeenCalledTimes(1);
    await unmount();
  });

  it('a refusal by status reads in words; the wallet keeps the tickets', async () => {
    transferMock.mockResolvedValue(err({ kind: 'unknown', status: 400 }));
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer('b@x.com');
    });
    expect(result.current.state).toEqual({ kind: 'refused', reason: 'notTransferable' });
    expect(drop).not.toHaveBeenCalled();
    await unmount();
  });

  it('after sign-out the wallet is not touched', async () => {
    transferMock.mockResolvedValue(ok({ transferredTo: 'b@x.com' }));
    mockSessionUser = null;
    const { result, unmount } = await renderHook(() => useTransferTickets(USER, 'e1'), opts());
    await act(async () => {
      await result.current.transfer('b@x.com');
    });
    expect(result.current.state.kind).toBe('done');
    expect(drop).not.toHaveBeenCalled();
    await unmount();
  });
});

describe('useRefundRequest', () => {
  it('201: remembers the request for this booking', async () => {
    refundMock.mockResolvedValue(ok({ id: 'r1' }));
    const { result, unmount } = await renderHook(() => useRefundRequest(USER, 'e1'), opts());
    expect(result.current.requested).toBe(false);
    await act(async () => {
      await result.current.send('Can’t make it');
    });
    expect(refundMock).toHaveBeenCalledWith({}, 'e1', 'Can’t make it');
    expect(result.current.state).toEqual({ kind: 'done', value: { id: 'r1' } });
    await waitFor(() => {
      expect(result.current.requested).toBe(true);
    });
    expect(mockKv.dump()['bh.refund-req.u1']).toBe('["e1"]');
    await unmount();
  });

  it('409 is the duplicate: "already asked", and it is remembered too', async () => {
    refundMock.mockResolvedValue(err({ kind: 'conflict', code: 'conflict' }));
    const { result, unmount } = await renderHook(() => useRefundRequest(USER, 'e1'), opts());
    await act(async () => {
      await result.current.send('Reason');
    });
    expect(result.current.state).toEqual({ kind: 'refused', reason: 'alreadyRequested' });
    await waitFor(() => {
      expect(result.current.requested).toBe(true);
    });
    await unmount();
  });

  it('an uncertain answer infers nothing', async () => {
    refundMock.mockResolvedValue(timeout);
    const { result, unmount } = await renderHook(() => useRefundRequest(USER, 'e1'), opts());
    await act(async () => {
      await result.current.send('Reason');
    });
    expect(result.current.state).toEqual({ kind: 'uncertain' });
    expect(result.current.requested).toBe(false);
    expect(mockKv.dump()).toEqual({});
    await unmount();
  });
});

describe('usePostReview', () => {
  const target = { listingId: 'l1', type: 'hotel' as const };

  it('posted: marks the listing reviewed and refreshes its reviews', async () => {
    reviewMock.mockResolvedValue(ok({ id: 'rv1' }));
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result, unmount } = await renderHook(() => usePostReview(USER, target), opts());
    await act(async () => {
      await result.current.post(4, 'Lovely stay, quiet room');
    });
    expect(reviewMock).toHaveBeenCalledWith({}, 'l1', 'hotel', 4, 'Lovely stay, quiet room');
    expect(result.current.state).toEqual({ kind: 'done', value: 'posted' });
    await waitFor(() => {
      expect(result.current.reviewed).toBe(true);
    });
    expect(spy).toHaveBeenCalledWith({ queryKey: ['discover', 'reviews', 'hotel', 'l1'] });
    await unmount();
  });

  it('409 already_reviewed counts as done', async () => {
    reviewMock.mockResolvedValue(err({ kind: 'conflict', code: 'already_reviewed' }));
    const { result, unmount } = await renderHook(
      () => usePostReview(USER, { listingId: 'l2', type: 'event' }),
      opts(),
    );
    await act(async () => {
      await result.current.post(5, 'Great night out!');
    });
    expect(result.current.state).toEqual({ kind: 'done', value: 'alreadyReviewed' });
    await waitFor(() => {
      expect(result.current.reviewed).toBe(true);
    });
    await unmount();
  });

  it('403 no_completed_booking is not eligible, and nothing is remembered', async () => {
    reviewMock.mockResolvedValue(err({ kind: 'forbidden', code: 'no_completed_booking' }));
    const { result, unmount } = await renderHook(() => usePostReview(USER, target), opts());
    await act(async () => {
      await result.current.post(3, 'Was okay overall');
    });
    expect(result.current.state).toEqual({ kind: 'refused', reason: 'notEligible' });
    expect(result.current.reviewed).toBe(false);
    expect(mockKv.dump()).toEqual({});
    await unmount();
  });

  it('without a listing it posts nothing', async () => {
    const { result, unmount } = await renderHook(() => usePostReview(USER, null), opts());
    await act(async () => {
      await result.current.post(3, 'Was okay overall');
    });
    expect(reviewMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: 'refused', reason: 'notEligible' });
    await unmount();
  });
});
