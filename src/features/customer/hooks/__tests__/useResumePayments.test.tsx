import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import {
  initializePayment,
  paymentState,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { holdPayScreen } from '@/features/customer/hooks/openPayScreens';
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

const MIN = 60_000;
/** Old enough to verify (A1: verify only for payments started 15 min ago or more). */
const OLD = 20 * MIN;

function entry(bookingId: string, reference: string | null, ageMs = MIN): CheckoutEntry {
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
        : { reference, paymentUrl: 'https://checkout.paystack.com/x', startedAt: NOW - ageMs },
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
  const mount = async (qc = makeQueryClient()) => {
    await renderHook(
      () => {
        useResumePayments(USER);
      },
      { wrapper: wrapper(qc) },
    );
    await flush();
  };

  it("resume after kill reads a fresh payment's status, never verifies it, never initialises", async () => {
    await checkoutStore.put(entry('b1', 'ref1'));
    await checkoutStore.put(entry('b2', null));
    await checkoutStore.put(entry('b3', 'ref3'));
    stateMock.mockImplementation((_c, ref) =>
      Promise.resolve(ref === 'ref1' ? polled('completed', true) : polled('pending', false)),
    );
    const qc = makeQueryClient();
    const invalidate = jest.spyOn(qc, 'invalidateQueries');
    await mount(qc);
    expect(verifyMock).not.toHaveBeenCalled();
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

  it('runs one entry at a time: an older payment gets verify then one status read', async () => {
    await checkoutStore.put(entry('b1', 'ref1', OLD));
    await checkoutStore.put(entry('b2', 'ref2', OLD));
    const order: string[] = [];
    verifyMock.mockImplementation((_c, ref) => {
      order.push(`verify:${ref}`);
      return Promise.resolve(ok<Verified>({ verified: false, status: 'pending' }));
    });
    stateMock.mockImplementation((_c, ref) => {
      order.push(`status:${ref}`);
      return Promise.resolve(polled('pending', false));
    });
    await mount();
    expect(order).toEqual(['verify:ref1', 'status:ref1', 'verify:ref2', 'status:ref2']);
  });

  it('an older failed payment keeps its entry with the payment cleared; an unanswered one is kept', async () => {
    await checkoutStore.put(entry('b1', 'ref1', OLD));
    await checkoutStore.put(entry('b2', 'ref2', OLD));
    stateMock.mockImplementation((_c, ref) =>
      Promise.resolve(
        ref === 'ref1'
          ? polled('failed', false)
          : err<ApiError>({ kind: 'unavailable', status: 503 }),
      ),
    );
    await mount();
    expect(await checkoutStore.get(USER, 'event', 'b1')).toEqual({
      ...entry('b1', null),
      paymentEverStarted: true,
    });
    expect(await checkoutStore.get(USER, 'event', 'b2')).toEqual(entry('b2', 'ref2', OLD));
  });

  it('a fresh payment that reads failed is kept: a transfer or USSD may still land (A1)', async () => {
    await checkoutStore.put(entry('b1', 'ref1', 14 * MIN));
    stateMock.mockResolvedValue(polled('failed', false));
    await mount();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(await checkoutStore.get(USER, 'event', 'b1')).toEqual(entry('b1', 'ref1', 14 * MIN));
  });

  it('skips a booking whose Pay screen is open', async () => {
    await checkoutStore.put(entry('b1', 'ref1', OLD));
    await checkoutStore.put(entry('b2', 'ref2', OLD));
    stateMock.mockResolvedValue(polled('pending', false));
    const release = holdPayScreen(USER, 'event', 'b1');
    try {
      await mount();
    } finally {
      release();
    }
    expect(verifyMock.mock.calls.map((c) => c[1])).toEqual(['ref2']);
    expect(stateMock.mock.calls.map((c) => c[1])).toEqual(['ref2']);
  });

  it('settling an older reference never clears a newer one written meanwhile (A4)', async () => {
    await checkoutStore.put(entry('b1', 'ref1', OLD));
    const ref2 = {
      reference: 'ref2',
      paymentUrl: 'https://checkout.paystack.com/y',
      startedAt: NOW,
    };
    stateMock.mockImplementation(async () => {
      // The Pay screen started a new payment while ref1's answer was on its way.
      await checkoutStore.setPayment(USER, 'event', 'b1', ref2);
      return polled('failed', false);
    });
    await mount();
    expect((await checkoutStore.get(USER, 'event', 'b1'))?.payment).toEqual(ref2);
  });

  it('checks again when the app comes back to the foreground', async () => {
    await checkoutStore.put(entry('b1', 'ref1'));
    stateMock.mockResolvedValue(polled('pending', false));
    await mount();
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
    expect(verifyMock).not.toHaveBeenCalled();
    expect(initMock).not.toHaveBeenCalled();
  });
});
