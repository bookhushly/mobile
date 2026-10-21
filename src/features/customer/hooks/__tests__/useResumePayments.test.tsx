import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import {
  initializePayment,
  paymentState,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { useResumePayments } from '@/features/customer/hooks/useResumePayments';
import { checkoutStore, type CheckoutEntry } from '@/features/customer/offline/checkoutStore';
import type { PaymentState, Verified } from '@/features/customer/schemas/checkout';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, USER, wrapper } from './customerTestUtils';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => Date.now() } }));
jest.mock('@/features/customer/api/checkoutApi', () => ({
  initializePayment: jest.fn(),
  verifyPayment: jest.fn(),
  paymentState: jest.fn(),
}));
jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));

const initMock = jest.mocked(initializePayment);
const verifyMock = jest.mocked(verifyPayment);
const stateMock = jest.mocked(paymentState);

const NOW = Date.parse('2026-10-21T12:00:00Z');

function entry(bookingId: string, reference: string | null): CheckoutEntry {
  return {
    userId: USER,
    kind: 'event',
    bookingId,
    listingId: 'l1',
    title: 'Afrobeats night',
    createdAt: new Date(NOW - 10 * 60_000).toISOString(),
    total: 20000,
    pricing: null,
    summary: { tickets: 2 },
    guestEmail: 'ada@example.com',
    payment:
      reference === null
        ? null
        : { reference, paymentUrl: 'https://checkout.paystack.com/x', startedAt: NOW - 60_000 },
    paymentEverStarted: reference !== null,
  };
}

const polled = (status: string, fulfilled: boolean) =>
  ok<PaymentState>({
    payment: { reference: 'r', status, fulfilled, request_type: 'event' },
    request: null,
  });

let onAppState: ((s: AppStateStatus) => void) | null = null;

beforeEach(async () => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  onAppState = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onAppState = handler;
    return {
      remove: () => {
        onAppState = null;
      },
    };
  });
  verifyMock.mockResolvedValue(ok<Verified>({ verified: false, status: 'pending' }));
  await checkoutStore.wipe();
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const flush = () =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });

describe('useResumePayments', () => {
  it('resume after kill verifies and never initialises', async () => {
    await checkoutStore.put(entry('b1', 'ref1'));
    await checkoutStore.put(entry('b2', null));
    await checkoutStore.put(entry('b3', 'ref3'));
    stateMock.mockImplementation((_c, ref) =>
      Promise.resolve(ref === 'ref1' ? polled('completed', true) : polled('pending', false)),
    );
    const qc = makeQueryClient();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    await renderHook(
      () => {
        useResumePayments(USER);
      },
      { wrapper: wrapper(qc) },
    );
    await flush();
    expect(verifyMock.mock.calls.map((c) => c[1])).toEqual(['ref1', 'ref3']);
    expect(stateMock.mock.calls.map((c) => c[1])).toEqual(['ref1', 'ref3']);
    expect(initMock).not.toHaveBeenCalled();
    // Paid: dropped and the lists reload. Still pending, or never paid: left as is.
    expect(await checkoutStore.get(USER, 'event', 'b1')).toBeNull();
    expect(await checkoutStore.get(USER, 'event', 'b2')).not.toBeNull();
    expect(await checkoutStore.get(USER, 'event', 'b3')).not.toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: customerKeys.booking(USER, 'event', 'b1'),
    });
  });

  it('runs one entry at a time: verify then one status read each', async () => {
    await checkoutStore.put(entry('b1', 'ref1'));
    await checkoutStore.put(entry('b2', 'ref2'));
    const order: string[] = [];
    verifyMock.mockImplementation((_c, ref) => {
      order.push(`verify:${ref}`);
      return Promise.resolve(ok<Verified>({ verified: false, status: 'pending' }));
    });
    stateMock.mockImplementation((_c, ref) => {
      order.push(`status:${ref}`);
      return Promise.resolve(polled('pending', false));
    });
    await renderHook(
      () => {
        useResumePayments(USER);
      },
      { wrapper: wrapper(makeQueryClient()) },
    );
    await flush();
    expect(order).toEqual(['verify:ref1', 'status:ref1', 'verify:ref2', 'status:ref2']);
  });

  it('a failed payment keeps its entry with the payment cleared; an unanswered one is kept', async () => {
    await checkoutStore.put(entry('b1', 'ref1'));
    await checkoutStore.put(entry('b2', 'ref2'));
    stateMock.mockImplementation((_c, ref) =>
      Promise.resolve(
        ref === 'ref1'
          ? polled('failed', false)
          : err<ApiError>({ kind: 'unavailable', status: 503 }),
      ),
    );
    await renderHook(
      () => {
        useResumePayments(USER);
      },
      { wrapper: wrapper(makeQueryClient()) },
    );
    await flush();
    expect(await checkoutStore.get(USER, 'event', 'b1')).toEqual({
      ...entry('b1', null),
      paymentEverStarted: true,
    });
    expect(await checkoutStore.get(USER, 'event', 'b2')).toEqual(entry('b2', 'ref2'));
  });

  it('checks again when the app comes back to the foreground', async () => {
    await checkoutStore.put(entry('b1', 'ref1'));
    stateMock.mockResolvedValue(polled('pending', false));
    await renderHook(
      () => {
        useResumePayments(USER);
      },
      { wrapper: wrapper(makeQueryClient()) },
    );
    await flush();
    expect(stateMock).toHaveBeenCalledTimes(1);
    await act(() => {
      onAppState?.('background');
    });
    await flush();
    expect(stateMock).toHaveBeenCalledTimes(1);
    await act(() => {
      onAppState?.('active');
    });
    await flush();
    expect(stateMock).toHaveBeenCalledTimes(2);
    expect(initMock).not.toHaveBeenCalled();
  });
});
