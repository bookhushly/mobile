import { act, renderHook } from '@testing-library/react-native';
import { openBrowserAsync } from 'expo-web-browser';

import { getCarRequest } from '@/features/customer/api/carRentalApi';
import {
  checkPayment,
  initializePayment,
  verifyPayment,
} from '@/features/customer/api/checkoutApi';
import { getLogistics } from '@/features/customer/api/logisticsApi';
import { getSecurity } from '@/features/customer/api/securityApi';
import { LOGISTICS_KIND, SECURITY_KIND } from '@/features/customer/hooks/rfqKinds';
import { useCarPayment, useRfqPayment } from '@/features/customer/hooks/useCarPayment';
import { carPayStore } from '@/features/customer/offline/carPayStore';

import { makeQueryClient, wrapper } from './customerTestUtils';

jest.mock('expo-web-browser', () => ({
  openBrowserAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  WebBrowserResultType: { OPENED: 'opened' },
}));
jest.mock('@/features/customer/api/carRentalApi', () => ({ getCarRequest: jest.fn() }));
jest.mock('@/features/customer/api/logisticsApi', () => ({ getLogistics: jest.fn() }));
jest.mock('@/features/customer/api/securityApi', () => ({ getSecurity: jest.fn() }));
jest.mock('@/features/customer/api/checkoutApi', () => ({
  checkPayment: jest.fn(),
  initializePayment: jest.fn(),
  verifyPayment: jest.fn(),
}));
jest.mock('@/features/customer/hooks/usePayment', () => ({ BROWSER_OPTIONS: {} }));
jest.mock('@/features/customer/offline/carPayStore', () => ({
  carPayStore: { get: jest.fn(), put: jest.fn(), drop: jest.fn() },
}));
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => mockNow } }));
const mockNow = Date.parse('2026-12-01T10:00:00Z');

const URL = 'https://checkout.paystack.com/abc';
const mocked = {
  check: jest.mocked(checkPayment),
  init: jest.mocked(initializePayment),
  verify: jest.mocked(verifyPayment),
  get: jest.mocked(getCarRequest),
  browser: jest.mocked(openBrowserAsync),
  store: jest.mocked(carPayStore),
};

const none = { ok: true as const, value: { hasPaid: false as const, hasPending: false as const } };
const pendingAt = (iso: string) => ({
  ok: true as const,
  value: {
    hasPaid: false as const,
    hasPending: true as const,
    payment: { reference: 'old', status: 'pending', created_at: iso },
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mocked.store.get.mockResolvedValue(null);
  mocked.store.put.mockResolvedValue(undefined);
  mocked.store.drop.mockResolvedValue(undefined);
  mocked.init.mockResolvedValue({
    ok: true,
    value: {
      success: true,
      payment: {
        id: 'p1',
        reference: 'ref1',
        amount: 114000,
        base_amount: 114000,
        service_charge_amount: 0,
        service_charge_label: null,
        currency: 'NGN',
        payment_url: URL,
      },
    },
  } as never);
  mocked.verify.mockResolvedValue({ ok: true, value: { verified: true, status: 'completed' } });
  // Reads paid straight away, so `settle` ends at once.
  mocked.get.mockResolvedValue({ ok: true, value: { status: 'paid' } } as never);
});

async function hook() {
  return renderHook(() => useCarPayment('u1', 'r1', false), {
    wrapper: wrapper(makeQueryClient()),
  });
}

it('starts a charge only when nothing is open, saving the reference before the browser opens', async () => {
  mocked.check.mockResolvedValue(none);
  const order: string[] = [];
  mocked.store.put.mockImplementation(() => {
    order.push('saved');
    return Promise.resolve();
  });
  mocked.browser.mockImplementation(() => {
    order.push('browser');
    return Promise.resolve({ type: 'cancel' } as never);
  });
  const { result } = await hook();
  await act(async () => {
    result.current.pay();
    await Promise.resolve();
  });
  expect(mocked.init).toHaveBeenCalledTimes(1);
  expect(order).toEqual(['saved', 'browser']);
  expect(result.current.state).toEqual({ kind: 'paid' });
});

it('never opens a checkout whose reference could not be saved', async () => {
  mocked.check.mockResolvedValue(none);
  mocked.store.put.mockRejectedValue(new Error('disk full'));
  const { result } = await hook();
  await act(async () => {
    result.current.pay();
    await Promise.resolve();
  });
  expect(mocked.browser).not.toHaveBeenCalled();
  expect(result.current.state.kind).toBe('error');
});

it('a recent open payment is checked, never charged again', async () => {
  mocked.check.mockResolvedValue(pendingAt('2026-12-01T09:55:00Z'));
  const { result } = await hook();
  await act(async () => {
    result.current.pay();
    await Promise.resolve();
  });
  expect(mocked.init).not.toHaveBeenCalled();
  expect(mocked.verify).toHaveBeenCalledWith({}, 'old');
});

it('without an answer from check-status, nothing is charged', async () => {
  mocked.check.mockResolvedValue({ ok: false, error: { kind: 'network' } });
  const { result } = await hook();
  await act(async () => {
    result.current.pay();
    await Promise.resolve();
  });
  expect(mocked.init).not.toHaveBeenCalled();
  expect(result.current.state.kind).toBe('error');
});

it('a double tap starts one payment', async () => {
  mocked.check.mockResolvedValue(none);
  const { result } = await hook();
  await act(async () => {
    result.current.pay();
    result.current.pay();
    await Promise.resolve();
  });
  expect(mocked.check).toHaveBeenCalledTimes(1);
  expect(mocked.init).toHaveBeenCalledTimes(1);
});

describe('paymentOpen (before a cancel)', () => {
  it('is clear only when nothing is open', async () => {
    mocked.check.mockResolvedValue(none);
    const { result } = await hook();
    await expect(result.current.paymentOpen()).resolves.toBe('clear');
  });

  it('an older open payment still clearing counts as open', async () => {
    mocked.check.mockResolvedValue(pendingAt('2026-12-01T09:00:00Z'));
    mocked.verify.mockResolvedValue({
      ok: true,
      value: { verified: false, status: 'pending', provider_status: 'processing' },
    });
    const { result } = await hook();
    await expect(result.current.paymentOpen()).resolves.toBe('open');
  });

  it('says unknown when the server cannot answer', async () => {
    mocked.check.mockResolvedValue({ ok: false, error: { kind: 'timeout' } });
    const { result } = await hook();
    await expect(result.current.paymentOpen()).resolves.toBe('unknown');
  });
});

it('a logistics payment is checked and started as logistics, and read back from logistics', async () => {
  mocked.check.mockResolvedValue(none);
  jest.mocked(getLogistics).mockResolvedValue({ ok: true, value: { status: 'paid' } } as never);
  const { result } = await renderHook(() => useRfqPayment(LOGISTICS_KIND, 'u1', 'l1', false), {
    wrapper: wrapper(makeQueryClient()),
  });
  await act(async () => {
    result.current.pay();
    await Promise.resolve();
  });
  expect(mocked.check).toHaveBeenCalledWith({}, 'logistics', 'l1');
  expect(mocked.init).toHaveBeenCalledWith({}, 'logistics', 'l1');
  expect(getLogistics).toHaveBeenCalled();
  expect(mocked.get).not.toHaveBeenCalled();
  expect(result.current.state).toEqual({ kind: 'paid' });
});

it('a security payment is checked and started as security', async () => {
  mocked.check.mockResolvedValue(none);
  jest.mocked(getSecurity).mockResolvedValue({ ok: true, value: { status: 'paid' } } as never);
  const { result } = await renderHook(() => useRfqPayment(SECURITY_KIND, 'u1', 's1', false), {
    wrapper: wrapper(makeQueryClient()),
  });
  await act(async () => {
    result.current.pay();
    await Promise.resolve();
  });
  expect(mocked.check).toHaveBeenCalledWith({}, 'security', 's1');
  expect(mocked.init).toHaveBeenCalledWith({}, 'security', 's1');
  expect(result.current.state).toEqual({ kind: 'paid' });
});
