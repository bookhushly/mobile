import { act, renderHook } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import { AppState, Platform, type AppStateStatus } from 'react-native';

import { cancelBooking } from '@/features/customer/api/bookingActionsApi';
import {
  checkPayment,
  initializePayment,
  paymentState,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { isPayScreenOpen } from '@/features/customer/hooks/openPayScreens';
import type { RowPayState } from '@/features/customer/domain/checkout/paymentFlow';
import { usePayment } from '@/features/customer/hooks/usePayment';
import { checkoutStore, type CheckoutEntry } from '@/features/customer/offline/checkoutStore';
import type {
  CheckStatus,
  Initialized,
  PaymentState,
  Verified,
} from '@/features/customer/schemas/checkout';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

import { makeQueryClient, USER, wrapper } from './customerTestUtils';

jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => Date.now() } }));
jest.mock('@/features/customer/api/checkoutApi', () => ({
  checkPayment: jest.fn(),
  initializePayment: jest.fn(),
  verifyPayment: jest.fn(),
  paymentState: jest.fn(),
}));
jest.mock('@/features/customer/api/bookingActionsApi', () => ({ cancelBooking: jest.fn() }));
jest.mock('@/shared/platform/storage', () => ({
  plainKv: jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv').memoryKv(),
}));
jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(),
  WebBrowserResultType: { OPENED: 'opened', CANCEL: 'cancel', DISMISS: 'dismiss' },
}));

const checkMock = jest.mocked(checkPayment);
const initMock = jest.mocked(initializePayment);
const verifyMock = jest.mocked(verifyPayment);
const stateMock = jest.mocked(paymentState);
const cancelMock = jest.mocked(cancelBooking);
const openMock = jest.mocked(WebBrowser.openBrowserAsync);

const NOW = Date.parse('2026-10-21T12:00:00Z');
const MIN = 60_000;
const URL1 = 'https://checkout.paystack.com/abc';
const BOOKING = 'b1';

const noPayment = ok<CheckStatus>({ hasPaid: false, hasPending: false });
const pendingRef = (reference: string, createdAt: string) =>
  ok<CheckStatus>({
    hasPaid: false,
    hasPending: true,
    payment: { reference, status: 'pending', created_at: createdAt },
  });
const initialized = (reference: string) =>
  ok<Initialized>({
    success: true,
    payment: {
      id: 'p1',
      reference,
      amount: 50000,
      base_amount: 50000,
      service_charge_amount: 0,
      service_charge_label: null,
      currency: 'NGN',
      payment_url: URL1,
    },
  });
const verified = (v: boolean, status: string) => ok<Verified>({ verified: v, status });
const polled = (status: string, fulfilled: boolean) =>
  ok<PaymentState>({
    payment: { reference: 'ref1', status, fulfilled, request_type: 'hotel' },
    request: null,
  });

function entry(over: Partial<CheckoutEntry> = {}): CheckoutEntry {
  return {
    userId: USER,
    kind: 'hotel',
    bookingId: BOOKING,
    listingId: 'ho1',
    title: 'Harbour Suites',
    createdAt: new Date(NOW - 60_000).toISOString(),
    total: 50000,
    pricing: { room_total: 50000 },
    summary: { checkIn: '2026-11-01', checkOut: '2026-11-03', guests: 2 },
    guestEmail: 'ada@example.com',
    payment: null,
    paymentEverStarted: false,
    ...over,
  };
}

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
  verifyMock.mockResolvedValue(verified(false, 'pending'));
  stateMock.mockResolvedValue(polled('pending', false));
  cancelMock.mockResolvedValue(err<ApiError>({ kind: 'network' }));
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
const advance = (ms: number) =>
  act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });

async function setup(
  e: CheckoutEntry | null = entry(),
  kind: 'hotel' | 'event' = 'hotel',
  row: {
    createdAt?: string | null;
    title?: string;
    total?: number;
    rowState?: RowPayState | null;
    fromSelect?: boolean;
  } = {},
) {
  if (e !== null) await checkoutStore.put(e);
  const qc = makeQueryClient();
  const invalidate = jest.spyOn(qc, 'invalidateQueries');
  const createdAt =
    row.createdAt === undefined ? new Date(NOW - 60_000).toISOString() : row.createdAt;
  const h = await renderHook(
    () =>
      usePayment(USER, kind, BOOKING, {
        createdAt,
        email: 'ada@example.com',
        ...(row.title !== undefined ? { title: row.title } : {}),
        ...(row.total !== undefined ? { total: row.total } : {}),
        rowState: row.rowState === undefined ? 'unpaid' : row.rowState,
        fromSelect: row.fromSelect ?? true,
      }),
    { wrapper: wrapper(qc) },
  );
  await flush();
  return { ...h, invalidate };
}

function withPlatform(os: 'ios' | 'android') {
  jest.replaceProperty(Platform, 'OS', os);
}

describe('usePayment', () => {
  it('pay twice sends one initialise', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockReturnValue(new Promise(() => undefined));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
      result.current.pay();
    });
    await flush();
    result.current.pay();
    await flush();
    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(initMock).toHaveBeenCalledWith({}, 'hotel', BOOKING, 'ada@example.com');
    expect(result.current.state).toEqual({
      step: 'inBrowser',
      reference: 'ref1',
      paymentStartedAt: NOW,
    });
  });

  it('pending reference with fresh stored url reopens it without initialise', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(pendingRef('ref1', new Date(NOW - 120_000).toISOString()));
    openMock.mockReturnValue(new Promise(() => undefined));
    const stored = { reference: 'ref1', paymentUrl: URL1, startedAt: NOW - 120_000 };
    const { result } = await setup(entry({ payment: stored }));
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(initMock).not.toHaveBeenCalled();
    expect(verifyMock).not.toHaveBeenCalled();
    expect(openMock).toHaveBeenCalledWith(URL1, { createTask: false, showInRecents: false });
    expect(result.current.state).toEqual({
      step: 'inBrowser',
      reference: 'ref1',
      paymentStartedAt: NOW - 120_000,
    });
  });

  it('an initialise URL off the Paystack allowlist is never opened (B3)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(
      ok<Initialized>({
        success: true,
        payment: {
          id: 'p1',
          reference: 'ref1',
          amount: 50000,
          base_amount: 50000,
          service_charge_amount: 0,
          service_charge_label: null,
          currency: 'NGN',
          payment_url: 'https://evil.test/pay',
        },
      }),
    );
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(openMock).not.toHaveBeenCalled();
    expect(result.current.state.step).toBe('startError');
    // The reference is kept (no URL): check-status settles it, and leaving never cancels.
    expect((await checkoutStore.get(USER, 'hotel', BOOKING))?.payment).toMatchObject({
      reference: 'ref1',
      paymentUrl: '',
    });
    expect(result.current.willCancelOnLeave).toBe(false);
  });

  it('entry is written before the browser opens', async () => {
    withPlatform('ios');
    const order: string[] = [];
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    const realSet = checkoutStore.setPayment.bind(checkoutStore);
    jest.spyOn(checkoutStore, 'setPayment').mockImplementation(async (...a) => {
      order.push('write');
      await realSet(...a);
      order.push('written');
    });
    openMock.mockImplementation(async () => {
      order.push('open');
      const saved = await checkoutStore.get(USER, 'hotel', BOOKING);
      order.push(`saved:${saved?.payment?.reference ?? 'none'}`);
      return new Promise(() => undefined);
    });
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(order).toEqual(['write', 'written', 'open', 'saved:ref1']);
    expect(openMock).toHaveBeenCalledWith(URL1, { createTask: false, showInRecents: false });
  });

  it('ios starts checking when the browser promise resolves', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    let close: (r: WebBrowser.WebBrowserResult) => void = () => undefined;
    openMock.mockReturnValue(
      new Promise((r) => {
        close = r;
      }),
    );
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state.step).toBe('inBrowser');
    expect(verifyMock).not.toHaveBeenCalled();
    await act(() => {
      close({ type: WebBrowser.WebBrowserResultType.DISMISS });
    });
    await flush();
    expect(result.current.state.step).toBe('checking');
    // A1: never verify a payment the customer may still be making; status polls only.
    await advance(2000);
    expect(stateMock).toHaveBeenCalledWith({}, 'ref1');
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('android starts checking on AppState active', async () => {
    withPlatform('android');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.OPENED });
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    // The Custom Tab promise said 'opened' at once: still in the browser.
    expect(result.current.state.step).toBe('inBrowser');
    expect(verifyMock).not.toHaveBeenCalled();
    await act(() => {
      onAppState?.('background');
    });
    await advance(5000);
    expect(stateMock).not.toHaveBeenCalled();
    await act(() => {
      onAppState?.('active');
    });
    await flush();
    expect(result.current.state.step).toBe('checking');
    await advance(2000);
    expect(stateMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('polls status on the schedule and ends done only when fulfilled', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    // Completed but not fulfilled: Done waits for a fulfilled status poll.
    stateMock
      .mockResolvedValueOnce(polled('completed', false))
      .mockResolvedValueOnce(polled('completed', true));
    const { result, invalidate } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state).toMatchObject({ step: 'checking', attempt: 0 });
    expect(stateMock).not.toHaveBeenCalled();
    await advance(1999);
    expect(stateMock).not.toHaveBeenCalled();
    await advance(1);
    expect(stateMock).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({ step: 'checking', attempt: 1 });
    await advance(3000);
    expect(stateMock).toHaveBeenCalledTimes(2);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'done', reference: 'ref1' });
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: customerKeys.booking(USER, 'hotel', BOOKING),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: customerKeys.wallet(USER) });
  });

  it('a failed verdict on a fresh payment is unconfirmed: payment kept, Check again polls (A1b)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    stateMock.mockResolvedValue(polled('failed', false));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    await advance(2000);
    expect(result.current.state).toEqual({
      step: 'unconfirmed',
      reference: 'ref1',
      paymentStartedAt: NOW,
    });
    expect((await checkoutStore.get(USER, 'hotel', BOOKING))?.payment?.reference).toBe('ref1');
    // Pay does nothing here: the customer checks again or goes to Bookings.
    result.current.pay();
    await flush();
    expect(initMock).toHaveBeenCalledTimes(1);
    stateMock.mockResolvedValue(polled('pending', false));
    await act(() => {
      result.current.checkAgain();
    });
    expect(result.current.state.step).toBe('checking');
    await advance(2000);
    expect(stateMock).toHaveBeenCalledTimes(2);
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('failed on a payment 15 min old: entry kept, payment cleared; Try again goes to Review (A1d)', async () => {
    withPlatform('ios');
    const started = NOW - 20 * MIN;
    checkMock.mockResolvedValue(pendingRef('ref1', new Date(started).toISOString()));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    stateMock.mockResolvedValue(polled('failed', false));
    const stored = { reference: 'ref1', paymentUrl: URL1, startedAt: started };
    const { result, invalidate } = await setup(
      entry({ payment: stored, paymentEverStarted: true }),
    );
    await act(() => {
      result.current.pay();
    });
    await flush();
    await advance(2000);
    expect(result.current.state).toEqual({ step: 'failed', reference: 'ref1' });
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).toEqual(
      entry({ payment: null, paymentEverStarted: true }),
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    // Try again: back to Review, nothing sent until Pay is tapped.
    await act(() => {
      result.current.retry();
    });
    expect(result.current.state).toEqual({ step: 'review' });
    expect(checkMock).toHaveBeenCalledTimes(1);
    expect(initMock).not.toHaveBeenCalled();
    // Pay: the new payment is on disk before the browser opens.
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref2'));
    const seen: (string | null)[] = [];
    openMock.mockImplementation(async () => {
      const e = await checkoutStore.get(USER, 'hotel', BOOKING);
      seen.push(e?.payment?.reference ?? null);
      return new Promise(() => undefined);
    });
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(seen).toEqual(['ref2']);
  });

  it('recentAttempt: a payment started under 15 min ago warns on Review', async () => {
    withPlatform('ios');
    const stored = { reference: 'ref1', paymentUrl: URL1, startedAt: NOW - MIN };
    const { result } = await setup(entry({ payment: stored, paymentEverStarted: true }));
    expect(result.current.recentAttempt).toBe(true);
    await advance(14 * MIN);
    expect(result.current.recentAttempt).toBe(false);
    await checkoutStore.wipe();
    const none = await setup(entry());
    expect(none.result.current.recentAttempt).toBe(false);
  });

  it('a cancelled or paid row never pays', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    for (const rowState of ['cancelled', 'paid'] as const) {
      const h = await setup(entry(), 'hotel', { rowState });
      expect(h.result.current.canPay).toBe(false);
      await act(() => {
        h.result.current.pay();
      });
      await flush();
      await h.unmount();
    }
    expect(checkMock).not.toHaveBeenCalled();
  });

  it('no entry: an entry with the payment is written before the browser opens', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    const order: string[] = [];
    initMock.mockImplementation(async () => {
      const e = await checkoutStore.get(USER, 'hotel', BOOKING);
      order.push(`init:started=${String(e?.paymentEverStarted)}`);
      return initialized('ref1');
    });
    openMock.mockImplementation(async () => {
      const e = await checkoutStore.get(USER, 'hotel', BOOKING);
      order.push(`open:${e?.payment?.reference ?? 'none'}`);
      return new Promise(() => undefined);
    });
    const { result } = await setup(null, 'hotel', { title: 'Harbour Suites', total: 50000 });
    expect(result.current.entry).toBeNull();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(order).toEqual(['init:started=true', 'open:ref1']);
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).toMatchObject({
      title: 'Harbour Suites',
      total: 50000,
      createdAt: new Date(NOW - 60_000).toISOString(),
      guestEmail: 'ada@example.com',
      pricing: null,
      paymentEverStarted: true,
      payment: { reference: 'ref1', paymentUrl: URL1 },
    });
  });

  it('canPay is false while a stay is of unknown age, and Pay does nothing', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    const { result } = await setup(null, 'hotel', { createdAt: null });
    expect(result.current.canPay).toBe(false);
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(checkMock).not.toHaveBeenCalled();
  });

  it('canPay is true for an event with no hold', async () => {
    withPlatform('ios');
    const { result } = await setup(null, 'event', { createdAt: null });
    expect(result.current.canPay).toBe(true);
    expect(result.current.holdEndsAt).toBeNull();
  });

  it('a paid check-status answer goes to checking, never straight to done', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(
      ok<CheckStatus>({
        hasPaid: true,
        payment: { reference: 'ref1', status: 'completed', created_at: '2026-10-21T11:58:00Z' },
      }),
    );
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(initMock).not.toHaveBeenCalled();
    expect(openMock).not.toHaveBeenCalled();
    expect(result.current.state.step).toBe('checking');
  });

  it('a recent pending reference with no url waits; it never initialises', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(pendingRef('ref9', new Date(NOW - 5 * 60_000).toISOString()));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    // A1: a reference under 15 min old is never verified.
    expect(verifyMock).not.toHaveBeenCalled();
    expect(initMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'pendingElsewhere' });
    // Check again re-runs check-status before anything else.
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockReturnValue(new Promise(() => undefined));
    await act(() => {
      result.current.checkAgain();
    });
    await flush();
    expect(checkMock).toHaveBeenCalledTimes(2);
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it('a lost initialise answer is not retried and Check again runs check-status', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(err<ApiError>({ kind: 'timeout' }));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state).toEqual({
      step: 'startError',
      words: "Couldn't start payment. Try again",
      action: 'tryAgain',
    });
    expect(initMock).toHaveBeenCalledTimes(1);
    checkMock.mockResolvedValue(pendingRef('ref1', new Date(NOW - 10_000).toISOString()));
    await act(() => {
      result.current.checkAgain();
    });
    await flush();
    expect(checkMock).toHaveBeenCalledTimes(2);
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it('a hold past 25 minutes ends without initialising', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    const { result } = await setup();
    expect(result.current.holdEndsAt).toBe(NOW - 60_000 + 25 * 60_000);
    expect(result.current.canPay).toBe(true);
    await advance(24 * 60_000);
    expect(result.current.state).toEqual({ step: 'holdEnded' });
    expect(result.current.canPay).toBe(false);
    result.current.pay();
    await flush();
    expect(checkMock).not.toHaveBeenCalled();
    expect(initMock).not.toHaveBeenCalled();
  });

  it('leave on review cancels the unpaid booking once check-status shows no payment', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    const { result } = await setup();
    await act(() => {
      result.current.leave();
    });
    await flush();
    expect(checkMock).toHaveBeenCalledWith({}, 'hotel', BOOKING);
    expect(cancelMock).toHaveBeenCalledWith({}, 'hotel', BOOKING);
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).toBeNull();
  });

  it.each([
    ['a pending payment', pendingRef('ref9', new Date(NOW - MIN).toISOString())],
    [
      'a paid one',
      ok<CheckStatus>({
        hasPaid: true,
        payment: { reference: 'ref9', status: 'completed', created_at: '2026-10-21T11:00:00Z' },
      }),
    ],
    ['no answer', err<ApiError>({ kind: 'timeout' })],
  ])('leave never cancels when check-status shows %s (A2a)', async (_name, answer) => {
    withPlatform('ios');
    checkMock.mockResolvedValue(answer);
    const { result } = await setup();
    await act(() => {
      result.current.leave();
    });
    await flush();
    expect(cancelMock).not.toHaveBeenCalled();
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).not.toBeNull();
  });

  it('leave from a Review not reached from Select never cancels, even with an entry (I1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    const { result } = await setup(entry(), 'hotel', { fromSelect: false });
    expect(result.current.willCancelOnLeave).toBe(false);
    await act(() => {
      result.current.leave();
    });
    await flush();
    expect(checkMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it.each<RowPayState | null>(['paid', 'cancelled', 'other', null])(
    'leave never cancels when the row reads %s (A2a)',
    async (rowState) => {
      withPlatform('ios');
      checkMock.mockResolvedValue(noPayment);
      const { result } = await setup(entry(), 'hotel', { rowState });
      expect(result.current.willCancelOnLeave).toBe(false);
      await act(() => {
        result.current.leave();
      });
      await flush();
      expect(cancelMock).not.toHaveBeenCalled();
    },
  );

  it('leave after payment started never cancels', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(err<ApiError>({ kind: 'network' }));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    // The initialise answer was lost: a payment may exist, so the booking stays.
    expect(result.current.state.step).toBe('startError');
    await act(() => {
      result.current.leave();
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('leave before the entry read lands never cancels', async () => {
    withPlatform('ios');
    jest.spyOn(checkoutStore, 'get').mockReturnValue(new Promise(() => undefined));
    const { result } = await setup(null);
    await act(() => {
      result.current.leave();
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('leave with no entry (opened from Bookings) never cancels', async () => {
    withPlatform('ios');
    const { result } = await setup(null);
    await act(() => {
      result.current.leave();
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('leave after a failed payment (payment cleared) never cancels', async () => {
    withPlatform('ios');
    const { result } = await setup(entry({ payment: null, paymentEverStarted: true }));
    await act(() => {
      result.current.leave();
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('leave after check-status saw a pending reference never cancels', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(pendingRef('ref9', new Date(NOW - 60_000).toISOString()));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state).toEqual({ step: 'pendingElsewhere' });
    // The hold passes; Check again turns into Start again, a step where leave may cancel.
    await advance(25 * 60_000);
    await act(() => {
      result.current.checkAgain();
    });
    expect(result.current.state).toEqual({ step: 'holdEnded' });
    await act(() => {
      result.current.leave();
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('willCancelOnLeave matches what leave would do', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(err<ApiError>({ kind: 'network' }));
    const made = await setup();
    expect(made.result.current.willCancelOnLeave).toBe(true);
    // A payment may exist once initialise was sent: leaving keeps the booking.
    await act(() => {
      made.result.current.pay();
    });
    await flush();
    expect(made.result.current.state.step).toBe('startError');
    expect(made.result.current.willCancelOnLeave).toBe(false);
    await made.unmount();

    await checkoutStore.wipe();
    const fromBookings = await setup(null);
    expect(fromBookings.result.current.willCancelOnLeave).toBe(false);
    await fromBookings.unmount();

    await checkoutStore.wipe();
    const started = await setup(entry({ paymentEverStarted: true }));
    expect(started.result.current.willCancelOnLeave).toBe(false);
  });

  it('willCancelOnLeave is false before the entry read lands', async () => {
    withPlatform('ios');
    jest.spyOn(checkoutStore, 'get').mockReturnValue(new Promise(() => undefined));
    const { result } = await setup(null);
    expect(result.current.willCancelOnLeave).toBe(false);
  });

  it('leave with a stored payment from an earlier session never cancels', async () => {
    withPlatform('ios');
    const stored = { reference: 'ref1', paymentUrl: URL1, startedAt: NOW - 60_000 };
    const { result } = await setup(entry({ payment: stored }));
    await act(() => {
      result.current.leave();
    });
    expect(cancelMock).not.toHaveBeenCalled();
  });

  it('marks its booking open for resume while mounted', async () => {
    withPlatform('ios');
    const { unmount } = await setup();
    expect(isPayScreenOpen(USER, 'hotel', BOOKING)).toBe(true);
    await unmount();
    expect(isPayScreenOpen(USER, 'hotel', BOOKING)).toBe(false);
  });

  it('clears the poll timer on unmount', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    const { result, unmount } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state.step).toBe('checking');
    await unmount();
    await advance(60_000);
    expect(stateMock).not.toHaveBeenCalled();
  });
});
