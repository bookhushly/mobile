import { act, renderHook } from '@testing-library/react-native';

import { validatePromo } from '@/features/customer/api/checkoutApi';
import { promoFor, usePromo, type PromoState } from '@/features/customer/hooks/usePromo';
import type { ApiError } from '@/shared/lib/errors';

jest.mock('@/features/customer/api/checkoutApi', () => ({ validatePromo: jest.fn() }));
jest.mock('@/shared/api/instance', () => ({ api: {} }));

const mockValidate = jest.mocked(validatePromo);
const LISTING = 'l1';
const COULD_NOT = 'Couldn’t check this code. Try again';

const valid = {
  ok: true as const,
  value: {
    valid: true as const,
    code_id: 'c1',
    code: 'SAVE10',
    discount_amount: 1000,
    discounted_total: 9000,
  },
};
const fail = (error: ApiError) => ({ ok: false as const, error });

beforeEach(() => {
  jest.clearAllMocks();
});

async function hook() {
  return renderHook(() => usePromo('event', LISTING));
}

it('applies a valid code, sending the code, service and estimate', async () => {
  mockValidate.mockResolvedValue(valid);
  const { result } = await hook();
  await act(() => result.current.apply('  save10 ', 10000));
  expect(mockValidate).toHaveBeenCalledWith(
    {},
    { code: 'save10', service_type: 'event', service_id: LISTING, amount: 10000 },
  );
  expect(result.current.state).toEqual({
    phase: 'applied',
    promo: { codeId: 'c1', code: 'SAVE10', discount: 1000, forAmount: 10000 },
  });
});

it('valid:false reads the server words', async () => {
  mockValidate.mockResolvedValue({
    ok: true,
    value: { valid: false, error: 'This promo code has expired' },
  });
  const { result } = await hook();
  await act(() => result.current.apply('OLD', 10000));
  expect(result.current.state).toEqual({ phase: 'invalid', words: 'This promo code has expired' });
});

it('a 400 reads its error text', async () => {
  mockValidate.mockResolvedValue(
    fail({ kind: 'unknown', status: 400, body: { error: 'Enter a promo code' } }),
  );
  const { result } = await hook();
  await act(() => result.current.apply('X', 10000));
  expect(result.current.state).toEqual({ phase: 'invalid', words: 'Enter a promo code' });
});

it('a 404 reads “doesn’t apply here”', async () => {
  mockValidate.mockResolvedValue(fail({ kind: 'notFound' }));
  const { result } = await hook();
  await act(() => result.current.apply('X', 10000));
  expect(result.current.state).toEqual({
    phase: 'invalid',
    words: 'This code doesn’t apply here',
  });
});

it.each<ApiError>([
  { kind: 'network' },
  { kind: 'timeout' },
  { kind: 'unavailable', status: 503 },
  { kind: 'rateLimited', retryAfterSec: 5 },
  { kind: 'unknown', status: 500, body: { error: 'Something went wrong — try again' } },
])('a transient %p is “couldn’t check”, never a refusal', async (error) => {
  mockValidate.mockResolvedValue(fail(error));
  const { result } = await hook();
  await act(() => result.current.apply('X', 10000));
  expect(result.current.state).toEqual({ phase: 'error', words: COULD_NOT });
});

it('a second apply while one is in flight sends nothing', async () => {
  let resolve: (v: typeof valid) => void = () => undefined;
  mockValidate.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result } = await hook();
  let first: Promise<void> = Promise.resolve();
  await act(async () => {
    first = result.current.apply('A', 10000);
    await result.current.apply('B', 10000);
  });
  expect(mockValidate).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolve(valid);
    await first;
  });
  expect(result.current.state.phase).toBe('applied');
});

it('a late answer after Remove is ignored', async () => {
  let resolve: (v: typeof valid) => void = () => undefined;
  mockValidate.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result } = await hook();
  let pending: Promise<void> = Promise.resolve();
  await act(() => {
    pending = result.current.apply('A', 10000);
  });
  expect(result.current.state.phase).toBe('checking');
  await act(() => {
    result.current.remove();
  });
  await act(async () => {
    resolve(valid);
    await pending;
  });
  expect(result.current.state).toEqual({ phase: 'idle' });
});

it('a late answer after unmount is dropped quietly', async () => {
  let resolve: (v: typeof valid) => void = () => undefined;
  mockValidate.mockReturnValue(
    new Promise((r) => {
      resolve = r;
    }),
  );
  const { result, unmount } = await hook();
  let pending: Promise<void> = Promise.resolve();
  await act(() => {
    pending = result.current.apply('A', 10000);
  });
  await unmount();
  const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  resolve(valid);
  await pending;
  expect(spy).not.toHaveBeenCalled();
  spy.mockRestore();
});

describe('promoFor', () => {
  const applied: PromoState = {
    phase: 'applied',
    promo: { codeId: 'c1', code: 'SAVE10', discount: 1000, forAmount: 10000 },
  };
  it('sends the code for the total it was previewed for', () => {
    expect(promoFor(applied, 10000)).toEqual({
      promo: { codeId: 'c1', discount: 1000 },
      stale: false,
    });
  });
  it('is stale once the total changes', () => {
    expect(promoFor(applied, 15000)).toEqual({ promo: null, stale: true });
    expect(promoFor(applied, null)).toEqual({ promo: null, stale: true });
  });
  it('is nothing without an applied code', () => {
    expect(promoFor({ phase: 'idle' }, 10000)).toEqual({ promo: null, stale: false });
    expect(promoFor({ phase: 'invalid', words: 'x' }, 10000)).toEqual({
      promo: null,
      stale: false,
    });
  });
});
