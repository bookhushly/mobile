import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { claim, claimCounts, sendClaimCode } from '@/features/customer/api/claimApi';
import { customerKeys } from '@/features/customer/hooks/customerKeys';
import { CLAIM_COUNTS_STALE_MS, useClaim } from '@/features/customer/hooks/useClaim';
import type { ClaimResult } from '@/features/customer/schemas/actions';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok, type Result } from '@/shared/lib/result';

import { makeQueryClient, USER, wrapper } from './customerTestUtils';

let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));
jest.mock('@/shared/api/instance', () => ({ api: {}, clock: { serverNow: () => Date.now() } }));
jest.mock('@/features/customer/api/claimApi', () => ({
  claimCounts: jest.fn(),
  sendClaimCode: jest.fn(),
  claim: jest.fn(),
}));

const countsMock = jest.mocked(claimCounts);
const sendMock = jest.mocked(sendClaimCode);
const claimMock = jest.mocked(claim);

const COUNTS = { events: 2, hotels: 1, apartments: 0, total: 3 };
const CLAIMED: ClaimResult = {
  claimed: COUNTS,
  booking_ids: null,
  payments: null,
};
const NOW = Date.parse('2026-10-19T10:00:00Z');

let qc: QueryClient;
beforeEach(() => {
  jest.useFakeTimers({ now: NOW });
  jest.clearAllMocks();
  mockFocused = true;
  qc = makeQueryClient();
  countsMock.mockResolvedValue(ok(COUNTS));
});
afterEach(() => {
  qc.clear();
  jest.useRealTimers();
});

async function run() {
  const hook = await renderHook(() => useClaim(USER), { wrapper: wrapper(qc) });
  await waitFor(() => {
    expect(countsMock).toHaveBeenCalled();
  });
  return hook;
}

describe('counts', () => {
  it('loads the claimable counts', async () => {
    const { result, unmount } = await run();
    await waitFor(() => {
      expect(result.current.counts).toEqual(COUNTS);
    });
    expect(result.current.blocked).toBeNull();
    expect(result.current.countsError).toBe(false);
    await unmount();
  });

  it.each([
    ['not_customer', 'notCustomer'],
    ['email_unverified', 'emailUnverified'],
  ] as const)('403 %s blocks the card', async (code, blocked) => {
    countsMock.mockResolvedValue(err({ kind: 'forbidden', code }));
    const { result, unmount } = await run();
    await waitFor(() => {
      expect(result.current.blocked).toBe(blocked);
    });
    expect(result.current.counts).toBeNull();
    expect(result.current.countsError).toBe(false);
    await unmount();
  });

  it.each<[string, ApiError]>([
    ['network', { kind: 'network' }],
    ['503', { kind: 'unavailable', status: 503, code: 'unavailable' }],
    ['429', { kind: 'rateLimited', retryAfterSec: 10 }],
    ['401', { kind: 'auth' }],
  ])('a failed check (%s) is its own error, never a block', async (_, e) => {
    countsMock.mockResolvedValue(err(e));
    const { result, unmount } = await run();
    await waitFor(() => {
      expect(result.current.countsError).toBe(true);
    });
    expect(result.current.counts).toBeNull();
    expect(result.current.blocked).toBeNull();
    await unmount();
  });

  it('re-checks on focus only once 5 minutes stale', async () => {
    const { result, rerender, unmount } = await run();
    await waitFor(() => {
      expect(result.current.counts).toEqual(COUNTS);
    });
    mockFocused = false;
    await rerender({});
    mockFocused = true;
    await rerender({});
    expect(countsMock).toHaveBeenCalledTimes(1);

    mockFocused = false;
    await rerender({});
    await act(async () => {
      await jest.advanceTimersByTimeAsync(CLAIM_COUNTS_STALE_MS + 1);
    });
    mockFocused = true;
    await rerender({});
    await waitFor(() => {
      expect(countsMock).toHaveBeenCalledTimes(2);
    });
    await unmount();
  });
});

describe('send and verify', () => {
  it('send → codeSent with a 60 s resend timer, verify → done and the list reloads', async () => {
    sendMock.mockResolvedValue(ok({ sent: true }));
    claimMock.mockResolvedValue(ok(CLAIMED));
    const spy = jest.spyOn(qc, 'invalidateQueries');
    const { result, unmount } = await run();
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.state).toEqual({ kind: 'codeSent', resendAt: NOW + 60_000 });
    await act(async () => {
      await result.current.verify('123456');
    });
    expect(claimMock).toHaveBeenCalledWith({}, '123456');
    expect(result.current.state).toEqual({ kind: 'done', total: 3 });
    expect(spy).toHaveBeenCalledWith({ queryKey: customerKeys.bookings(USER) });
    expect(spy).toHaveBeenCalledWith({ queryKey: customerKeys.claimCounts(USER) });
    await unmount();
  });

  it('a wrong code keeps the code step and its timer', async () => {
    sendMock.mockResolvedValue(ok({ sent: true }));
    claimMock.mockResolvedValue(err({ kind: 'forbidden', code: 'invalid_code' }));
    const { result, unmount } = await run();
    await act(async () => {
      await result.current.send();
    });
    await act(async () => {
      await result.current.verify('000000');
    });
    expect(result.current.state).toEqual({
      kind: 'error',
      step: 'verify',
      outcome: { kind: 'refused', reason: 'invalidCode' },
      resendAt: NOW + 60_000,
    });
    await unmount();
  });

  it('a rate-limited send waits the server’s retry_after, neutrally', async () => {
    sendMock.mockResolvedValue(err({ kind: 'rateLimited', retryAfterSec: 120 }));
    const { result, unmount } = await run();
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.state).toEqual({
      kind: 'error',
      step: 'send',
      outcome: { kind: 'rateLimited', retryAfterSec: 120 },
      resendAt: NOW + 120_000,
    });
    await unmount();
  });

  it('a send that failed transiently is uncertain (try again), not a refusal', async () => {
    sendMock.mockResolvedValue(err({ kind: 'unavailable', status: 503, code: 'send_failed' }));
    const { result, unmount } = await run();
    await act(async () => {
      await result.current.send();
    });
    expect(result.current.state).toMatchObject({ kind: 'error', outcome: { kind: 'uncertain' } });
    await unmount();
  });

  it('is single-flight across send and verify', async () => {
    let answer: (r: Result<{ sent: true }, ApiError>) => void = () => undefined;
    sendMock.mockReturnValue(
      new Promise((r) => {
        answer = r;
      }),
    );
    const { result, unmount } = await run();
    let first: Promise<void> = Promise.resolve();
    await act(async () => {
      first = result.current.send();
      await result.current.send();
      await result.current.verify('123456');
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(claimMock).not.toHaveBeenCalled();
    expect(result.current.state).toEqual({ kind: 'sending' });
    await act(async () => {
      answer(ok({ sent: true }));
      await first;
    });
    expect(result.current.state.kind).toBe('codeSent');
    await act(() => {
      result.current.reset();
    });
    expect(result.current.state).toEqual({ kind: 'idle' });
    await unmount();
  });
});
