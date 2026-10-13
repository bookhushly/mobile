import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { fetchTicketCode } from '@/features/customer/api/ticketCodeApi';
import { REFRESH_AFTER_ERROR_MS } from '@/features/customer/domain/liveCode';
import { useLiveCode } from '@/features/customer/hooks/useLiveCode';
import type { TicketCodeBody } from '@/features/customer/schemas/ticketCode';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

// The server clock runs 5 min ahead of the phone: timing must follow the server, not Date.now().
const SKEW = 300_000;
jest.mock('@/shared/api/instance', () => ({
  api: {},
  clock: { serverNow: () => Date.now() + 300_000 },
}));
jest.mock('@/features/customer/api/ticketCodeApi', () => ({ fetchTicketCode: jest.fn() }));

const fetchCode = jest.mocked(fetchTicketCode);
const serverNow = () => Date.now() + SKEW;

function code(token: string, expiresInMs = 30_000) {
  const body: TicketCodeBody = {
    token,
    format: 2,
    expires_at: serverNow() + expiresInMs,
    step_seconds: 30,
    ticket: { ticket_type: 'Regular', ticket_index: 1 },
  };
  return ok(body);
}
// Built when fetched, so `expires_at` is relative to that moment.
const live = (token: string) => () => Promise.resolve(code(token));
const fail = (e: ApiError) => err(e);

let onAppState: ((s: AppStateStatus) => void) | null = null;
const removeSub = jest.fn();

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse('2026-10-13T18:00:00Z') });
  jest.clearAllMocks();
  onAppState = null;
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onAppState = handler;
    return { remove: removeSub };
  });
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
  AppState.currentState = 'active';
});

async function advance(ms: number) {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(ms);
  });
}

async function run(ticketId: string | null = 't1', active = true) {
  const hook = await renderHook(
    ({ id, on }: { id: string | null; on: boolean }) => useLiveCode(id, on),
    { initialProps: { id: ticketId, on: active } },
  );
  await advance(0);
  return hook;
}

it('fetches, then refreshes 2 s before expiry on the server clock', async () => {
  fetchCode.mockImplementationOnce(live('A')).mockImplementationOnce(live('B'));
  const { result, unmount } = await run();
  expect(fetchCode).toHaveBeenCalledTimes(1);
  expect(fetchCode).toHaveBeenCalledWith({}, 't1');
  expect(result.current).toMatchObject({ kind: 'live', token: 'A' });

  await advance(27_999);
  expect(fetchCode).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(fetchCode).toHaveBeenCalledTimes(2);
  expect(result.current).toMatchObject({ kind: 'live', token: 'B' });
  await unmount();
});

it('stops polling once the ticket is admitted', async () => {
  fetchCode.mockResolvedValue(
    fail({ kind: 'conflict', code: 'conflict', body: { checked_in_at: '2026-10-13T18:42:00Z' } }),
  );
  const { result, unmount } = await run();
  expect(result.current).toEqual({ kind: 'admitted', at: '2026-10-13T18:42:00Z' });
  await advance(120_000);
  expect(fetchCode).toHaveBeenCalledTimes(1);
  await unmount();
});

it('keeps the last token through a 429 until the server would refuse it', async () => {
  fetchCode
    .mockImplementationOnce(live('A'))
    .mockResolvedValueOnce(fail({ kind: 'rateLimited', retryAfterSec: 60 }))
    .mockImplementationOnce(live('C'));
  const { result, unmount } = await run();
  await advance(28_000);
  expect(fetchCode).toHaveBeenCalledTimes(2);
  expect(result.current).toMatchObject({ kind: 'rateLimited', last: { token: 'A' } });

  // Token A expires at 30 s; the server accepts it for one more step (until 60 s).
  await advance(31_999);
  expect(result.current).toMatchObject({ kind: 'rateLimited', last: { token: 'A' } });
  await advance(1);
  expect(result.current).toEqual({ kind: 'fallback' });

  // Retry-After 60 s from the 429 at 28 s.
  await advance(27_999);
  expect(fetchCode).toHaveBeenCalledTimes(2);
  await advance(1);
  expect(fetchCode).toHaveBeenCalledTimes(3);
  expect(result.current).toMatchObject({ kind: 'live', token: 'C' });
  await unmount();
});

it('a 429 with no token yet waits 15 s by default and shows the fallback', async () => {
  fetchCode.mockResolvedValueOnce(fail({ kind: 'rateLimited' })).mockImplementationOnce(live('A'));
  const { result, unmount } = await run();
  expect(result.current).toEqual({ kind: 'fallback' });
  await advance(14_999);
  expect(fetchCode).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(result.current).toMatchObject({ kind: 'live', token: 'A' });
  await unmount();
});

it('after a transient failure, retries every 15 s', async () => {
  fetchCode
    .mockResolvedValueOnce(fail({ kind: 'network' }))
    .mockResolvedValueOnce(fail({ kind: 'unavailable', status: 503 }))
    .mockImplementationOnce(live('A'));
  const { result, unmount } = await run();
  expect(result.current).toEqual({ kind: 'fallback' });
  await advance(REFRESH_AFTER_ERROR_MS - 1);
  expect(fetchCode).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(fetchCode).toHaveBeenCalledTimes(2);
  await advance(REFRESH_AFTER_ERROR_MS);
  expect(fetchCode).toHaveBeenCalledTimes(3);
  expect(result.current).toMatchObject({ kind: 'live', token: 'A' });
  await unmount();
});

it('never polls while inactive or without a ticket', async () => {
  const a = await run('t1', false);
  const b = await run(null, true);
  await advance(60_000);
  expect(fetchCode).not.toHaveBeenCalled();
  expect(a.result.current).toEqual({ kind: 'loading' });
  expect(b.result.current).toEqual({ kind: 'loading' });
  await a.unmount();
  await b.unmount();
});

it('pauses in the background and catches up on return', async () => {
  fetchCode.mockImplementation(live('A'));
  const { unmount } = await run();
  expect(fetchCode).toHaveBeenCalledTimes(1);

  AppState.currentState = 'background';
  await act(() => {
    onAppState?.('background');
  });
  await advance(120_000);
  expect(fetchCode).toHaveBeenCalledTimes(1);

  AppState.currentState = 'active';
  await act(() => {
    onAppState?.('active');
  });
  await advance(0);
  expect(fetchCode).toHaveBeenCalledTimes(2);
  await unmount();
});

it('stops when deactivated or unmounted, and keeps a fresh code when reactivated', async () => {
  fetchCode.mockImplementation(live('A'));
  const hook = await run();
  await hook.rerender({ id: 't1', on: false });
  await advance(60_000);
  expect(fetchCode).toHaveBeenCalledTimes(1);

  // Back on screen with a code that is long expired: fetch at once.
  await hook.rerender({ id: 't1', on: true });
  await advance(0);
  expect(fetchCode).toHaveBeenCalledTimes(2);

  // Back again within the code's life: no fetch until its refresh time.
  await hook.rerender({ id: 't1', on: false });
  await advance(5_000);
  await hook.rerender({ id: 't1', on: true });
  await advance(0);
  expect(fetchCode).toHaveBeenCalledTimes(2);
  await advance(23_000);
  expect(fetchCode).toHaveBeenCalledTimes(3);

  await hook.unmount();
  expect(removeSub).toHaveBeenCalled();
  await advance(120_000);
  expect(fetchCode).toHaveBeenCalledTimes(3);
});

it('a new ticket starts from loading, not the previous ticket’s code', async () => {
  let resolveSecond: (v: ReturnType<typeof code>) => void = () => undefined;
  fetchCode
    .mockImplementationOnce(live('A'))
    .mockReturnValueOnce(new Promise((r) => (resolveSecond = r)));
  const hook = await run();
  expect(hook.result.current).toMatchObject({ token: 'A' });
  await hook.rerender({ id: 't2', on: true });
  await advance(0);
  expect(hook.result.current).toEqual({ kind: 'loading' });
  expect(fetchCode).toHaveBeenLastCalledWith({}, 't2');
  await act(async () => {
    resolveSecond(code('B'));
    await Promise.resolve();
  });
  expect(hook.result.current).toMatchObject({ kind: 'live', token: 'B' });
  await hook.unmount();
});
