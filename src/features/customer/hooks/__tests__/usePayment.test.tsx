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
const initialized = (reference: string, reused?: boolean) =>
  ok<Initialized>({
    success: true,
    ...(reused !== undefined ? { reused } : {}),
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
const verified = (v: boolean, status: string, provider?: string | null) =>
  ok<Verified>({
    verified: v,
    status,
    ...(provider !== undefined ? { provider_status: provider } : {}),
  });
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
    // V1: verify once on return, then status polls.
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledWith({}, 'ref1');
    expect(stateMock).not.toHaveBeenCalled();
    await advance(2000);
    expect(stateMock).toHaveBeenCalledWith({}, 'ref1');
    expect(verifyMock).toHaveBeenCalledTimes(1);
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
    expect(verifyMock).toHaveBeenCalledTimes(1);
    await advance(2000);
    expect(stateMock).toHaveBeenCalledTimes(1);
    expect(verifyMock).toHaveBeenCalledTimes(1);
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
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(result.current.state).toEqual({ step: 'done', reference: 'ref1' });
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: customerKeys.booking(USER, 'hotel', BOOKING),
    });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: customerKeys.wallet(USER) });
  });

  it('a failed status without a definitive verify is unconfirmed: payment kept, Check again verifies and polls (V1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    verifyMock.mockResolvedValue(verified(false, 'failed', 'abandoned'));
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
    verifyMock.mockResolvedValue(verified(false, 'pending', 'ongoing'));
    await act(() => {
      result.current.checkAgain();
    });
    await flush();
    expect(result.current.state.step).toBe('checking');
    expect(verifyMock).toHaveBeenCalledTimes(2);
    await advance(2000);
    expect(stateMock).toHaveBeenCalledTimes(2);
  });

  it('a definitive failure (Paystack failed) is Failed at once: payment cleared; Try again goes to Review and pays right away (V1)', async () => {
    withPlatform('ios');
    const started = NOW - 2 * MIN;
    checkMock.mockResolvedValue(pendingRef('ref1', new Date(started).toISOString()));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    verifyMock.mockResolvedValue(verified(false, 'failed', 'failed'));
    const stored = { reference: 'ref1', paymentUrl: URL1, startedAt: started };
    const { result, invalidate } = await setup(
      entry({ payment: stored, paymentEverStarted: true }),
    );
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state).toEqual({ step: 'failed', reference: 'ref1' });
    expect(stateMock).not.toHaveBeenCalled();
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
    // Pay: the failed row isn't pending, so a new payment, on disk before the browser opens.
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

  it('providerPending: Review warns only after a verify says Paystack is still clearing (V4)', async () => {
    withPlatform('ios');
    const stored = { reference: 'ref1', paymentUrl: URL1, startedAt: NOW - MIN };
    const { result } = await setup(entry({ payment: stored, paymentEverStarted: true }));
    // A recent attempt on this device alone never warns.
    expect(result.current.providerPending).toBe(false);
    checkMock.mockResolvedValue(pendingRef('ref1', new Date(NOW - MIN).toISOString()));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    verifyMock.mockResolvedValue(verified(false, 'pending', 'ongoing'));
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.providerPending).toBe(true);
    // A later verify that no longer says so clears it.
    verifyMock.mockResolvedValue(verified(false, 'pending', 'abandoned'));
    stateMock.mockResolvedValue(polled('pending', false));
    for (let i = 0; i < 15 && result.current.state.step === 'checking'; i += 1) {
      await advance(15_000);
    }
    expect(result.current.state.step).toBe('stillChecking');
    await act(() => {
      result.current.checkAgain();
    });
    await flush();
    expect(result.current.providerPending).toBe(false);
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

  it('a pending reference under 30 min with no url reopens the checkout web hands back (V3)', async () => {
    withPlatform('ios');
    const created = NOW - 5 * MIN;
    checkMock.mockResolvedValue(pendingRef('ref9', new Date(created).toISOString()));
    initMock.mockResolvedValue(initialized('ref9', true));
    const seen: (string | null)[] = [];
    openMock.mockImplementation(async () => {
      const e = await checkoutStore.get(USER, 'hotel', BOOKING);
      seen.push(e?.payment?.reference ?? null);
      return new Promise(() => undefined);
    });
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    // Signed in, without email: web compares the owner's own email.
    expect(initMock).toHaveBeenCalledWith({}, 'hotel', BOOKING);
    expect(verifyMock).not.toHaveBeenCalled();
    expect(seen).toEqual(['ref9']);
    expect((await checkoutStore.get(USER, 'hotel', BOOKING))?.payment).toEqual({
      reference: 'ref9',
      paymentUrl: URL1,
      startedAt: created,
    });
    expect(result.current.state).toEqual({
      step: 'inBrowser',
      reference: 'ref9',
      paymentStartedAt: created,
    });
  });

  it.each([
    ['a fresh charge (no reused)', () => initialized('ref9')],
    ['another reference', () => initialized('refX', true)],
    ['a lost answer', () => err<ApiError>({ kind: 'timeout' })],
  ])('V3 never opens %s: it is pendingElsewhere', async (_name, answer) => {
    withPlatform('ios');
    checkMock.mockResolvedValue(pendingRef('ref9', new Date(NOW - 5 * MIN).toISOString()));
    initMock.mockResolvedValue(answer());
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(openMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'pendingElsewhere' });
    expect((await checkoutStore.get(USER, 'hotel', BOOKING))?.payment).toBeNull();
    // Leaving never cancels after this: a payment may exist.
    expect(result.current.willCancelOnLeave).toBe(false);
    // Check again re-runs check-status before anything else.
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockReturnValue(new Promise(() => undefined));
    await act(() => {
      result.current.checkAgain();
    });
    await flush();
    expect(checkMock).toHaveBeenCalledTimes(2);
    expect(initMock).toHaveBeenCalledTimes(2);
  });

  it('a pending reference 30 min old with no url waits while Paystack says it is clearing (V2)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(pendingRef('ref9', new Date(NOW - 3 * 60 * MIN).toISOString()));
    verifyMock.mockResolvedValue(verified(false, 'pending', 'processing'));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(verifyMock).toHaveBeenCalledTimes(1);
    expect(initMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'pendingElsewhere' });
    expect(result.current.providerPending).toBe(true);
  });

  it('a pending reference 30 min old that verify fails is replaced by a new initialise (P26)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(pendingRef('ref9', new Date(NOW - 40 * MIN).toISOString()));
    verifyMock.mockResolvedValue(verified(false, 'failed', 'abandoned'));
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockReturnValue(new Promise(() => undefined));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(initMock).toHaveBeenCalledWith({}, 'hotel', BOOKING, 'ada@example.com');
    expect(result.current.state.step).toBe('inBrowser');
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
      words: 'Couldn’t start payment. Try again',
      action: 'tryAgain',
    });
    expect(initMock).toHaveBeenCalledTimes(1);
    checkMock.mockResolvedValue(pendingRef('ref1', new Date(NOW - 10_000).toISOString()));
    initMock.mockResolvedValue(initialized('refNew'));
    await act(() => {
      result.current.checkAgain();
    });
    await flush();
    expect(checkMock).toHaveBeenCalledTimes(2);
    // The pending reference is only asked back (V3, no email); a fresh charge is never opened.
    expect(initMock).toHaveBeenCalledTimes(2);
    expect(initMock).toHaveBeenLastCalledWith({}, 'hotel', BOOKING);
    expect(openMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ step: 'pendingElsewhere' });
  });

  it('409 already_paid is never retried: check-status names the paid reference for Checking (W1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValueOnce(noPayment).mockResolvedValueOnce(
      ok<CheckStatus>({
        hasPaid: true,
        payment: { reference: 'refPaid', status: 'completed', created_at: '2026-10-21T11:50:00Z' },
      }),
    );
    initMock.mockResolvedValue(err<ApiError>({ kind: 'conflict', code: 'already_paid' }));
    const { result, invalidate } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(initMock).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({ step: 'checking', reference: 'refPaid' });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: customerKeys.booking(USER, 'hotel', BOOKING),
    });
  });

  it('409 already_paid without a paid reference says so, with no retry (W1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(err<ApiError>({ kind: 'conflict', code: 'already_paid' }));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state).toEqual({
      step: 'startError',
      words: 'This booking is already paid.',
      action: 'paid',
    });
    expect(initMock).toHaveBeenCalledTimes(1);
  });

  it('500 record_failed says Check again, which runs check-status before any new Pay (W1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(
      err<ApiError>({ kind: 'unavailable', status: 500, code: 'record_failed' }),
    );
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    expect(result.current.state).toEqual({
      step: 'startError',
      words: 'Couldn’t start payment. Check again.',
      action: 'checkAgain',
    });
    checkMock.mockResolvedValue(pendingRef('ref1', new Date(NOW - 10_000).toISOString()));
    initMock.mockResolvedValue(err<ApiError>({ kind: 'network' }));
    await act(() => {
      result.current.checkAgain();
    });
    await flush();
    expect(checkMock).toHaveBeenCalledTimes(2);
    // Only the V3 ask-back (no email); never a new charge with the payer's email.
    expect(initMock).toHaveBeenCalledTimes(2);
    expect(initMock).toHaveBeenLastCalledWith({}, 'hotel', BOOKING);
    expect(result.current.state).toEqual({ step: 'pendingElsewhere' });
  });

  it('a 503 status poll with Retry-After waits at least that long, and is never failed (W4)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    initMock.mockResolvedValue(initialized('ref1'));
    openMock.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });
    stateMock
      .mockResolvedValueOnce(
        err<ApiError>({ kind: 'unavailable', status: 503, code: 'fetch_failed', retryAfterSec: 9 }),
      )
      .mockResolvedValue(polled('pending', false));
    const { result } = await setup();
    await act(() => {
      result.current.pay();
    });
    await flush();
    await advance(2000);
    expect(stateMock).toHaveBeenCalledTimes(1);
    expect(result.current.state).toMatchObject({ step: 'checking', attempt: 1, nextDelayMs: 9000 });
    await advance(8999);
    expect(stateMock).toHaveBeenCalledTimes(1);
    await advance(1);
    expect(stateMock).toHaveBeenCalledTimes(2);
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

  it('cancelNow runs check-status, cancels and drops the entry, and says cancelled (G1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    cancelMock.mockResolvedValue(ok({ refunded: false, refundMessage: null }));
    const { result, invalidate } = await setup();
    let r: string | undefined;
    await act(async () => {
      r = await result.current.cancelNow();
    });
    expect(r).toBe('cancelled');
    expect(checkMock).toHaveBeenCalledWith({}, 'hotel', BOOKING);
    expect(cancelMock).toHaveBeenCalledWith({}, 'hotel', BOOKING);
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).toBeNull();
    expect(invalidate).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
  });

  it('cancelNow keeps a booking with a payment and stops offering Cancel booking (G1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(pendingRef('ref9', new Date(NOW - MIN).toISOString()));
    const { result } = await setup();
    expect(result.current.willCancelOnLeave).toBe(true);
    let r: string | undefined;
    await act(async () => {
      r = await result.current.cancelNow();
    });
    expect(r).toBe('paymentInProgress');
    expect(cancelMock).not.toHaveBeenCalled();
    expect(result.current.willCancelOnLeave).toBe(false);
  });

  it.each([
    ['a lost check-status', err<ApiError>({ kind: 'network' }), null],
    ['a lost cancel', noPayment, err<ApiError>({ kind: 'unavailable', status: 503 })],
  ])('cancelNow after %s is notDone, never a refusal (G1)', async (_n, check, cancel) => {
    withPlatform('ios');
    checkMock.mockResolvedValue(check);
    if (cancel !== null) cancelMock.mockResolvedValue(cancel);
    const { result } = await setup();
    let r: string | undefined;
    await act(async () => {
      r = await result.current.cancelNow();
    });
    expect(r).toBe('notDone');
    expect(await checkoutStore.get(USER, 'hotel', BOOKING)).not.toBeNull();
  });

  it('cancelNow refused by the server says refused (G1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    cancelMock.mockResolvedValue(err<ApiError>({ kind: 'conflict', code: 'check_in_passed' }));
    const { result } = await setup();
    let r: string | undefined;
    await act(async () => {
      r = await result.current.cancelNow();
    });
    expect(r).toBe('refused');
  });

  it('cancelNow from a Review not reached from Select never cancels (G1)', async () => {
    withPlatform('ios');
    checkMock.mockResolvedValue(noPayment);
    const { result } = await setup(entry(), 'hotel', { fromSelect: false });
    let r: string | undefined;
    await act(async () => {
      r = await result.current.cancelNow();
    });
    expect(r).toBe('paymentInProgress');
    expect(checkMock).not.toHaveBeenCalled();
    expect(cancelMock).not.toHaveBeenCalled();
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
