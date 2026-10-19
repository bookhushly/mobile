import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { fetchEventCodes } from '@/features/customer/api/eventCodesApi';
import { FALLBACK } from '@/features/customer/api/fallback';
import { REFRESH_AFTER_ERROR_MS } from '@/features/customer/domain/liveCode';
import { useLiveCodes } from '@/features/customer/hooks/useLiveCodes';
import type { EventCodes } from '@/features/customer/schemas/actions';
import type { ApiError } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

// The server clock runs 5 min ahead of the phone: timing must follow the server.
const SKEW = 300_000;
jest.mock('@/shared/api/instance', () => ({
  api: {},
  clock: { serverNow: () => Date.now() + 300_000 },
}));
jest.mock('@/features/customer/api/eventCodesApi', () => ({ fetchEventCodes: jest.fn() }));

const fetchCodes = jest.mocked(fetchEventCodes);
const serverNow = () => Date.now() + SKEW;

function codes(t1: string | null, t2: string | null = 'T2'): EventCodes {
  return {
    format: 2,
    expiresAt: serverNow() + 30_000,
    stepSeconds: 30,
    tickets: [
      {
        id: 't1',
        type: 'VIP',
        index: 1,
        checkedInAt: t1 === null ? '2026-10-13T18:42:00Z' : null,
        token: t1,
      },
      {
        id: 't2',
        type: 'VIP',
        index: 2,
        checkedInAt: t2 === null ? '2026-10-13T18:43:00Z' : null,
        token: t2,
      },
    ],
  };
}
// Built when fetched, so `expiresAt` is relative to that moment.
const live =
  (t1: string | null, t2: string | null = 'T2') =>
  () =>
    Promise.resolve(ok(codes(t1, t2)));
const fail = (e: ApiError) => err(e);

let onAppState: ((s: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers({ now: Date.parse('2026-10-13T18:00:00Z') });
  jest.clearAllMocks();
  onAppState = null;
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    onAppState = handler;
    return { remove: jest.fn() };
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

async function run(bookingId: string | null = 'e1', active = true) {
  const hook = await renderHook(
    ({ id, on }: { id: string | null; on: boolean }) => useLiveCodes(id, on),
    { initialProps: { id: bookingId, on: active } },
  );
  await advance(0);
  return hook;
}

it('one fetch per booking, each ticket read from it, refreshed 2 s before expiry (server clock)', async () => {
  fetchCodes.mockImplementationOnce(live('A1', 'A2')).mockImplementationOnce(live('B1', 'B2'));
  const { result, unmount } = await run();
  expect(fetchCodes).toHaveBeenCalledTimes(1);
  expect(fetchCodes).toHaveBeenCalledWith({}, 'e1');
  expect(result.current.perTicket).toBe(false);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'live', token: 'A1' });
  expect(result.current.stateOf('t2')).toMatchObject({ kind: 'live', token: 'A2' });

  await advance(27_999);
  expect(fetchCodes).toHaveBeenCalledTimes(1);
  await advance(1);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  expect(result.current.stateOf('t2')).toMatchObject({ kind: 'live', token: 'B2' });
  await unmount();
});

it('a null token reads "Admitted"; once every ticket is used, polling stops', async () => {
  fetchCodes.mockImplementationOnce(live(null, 'A2')).mockImplementation(live(null, null));
  const { result, unmount } = await run();
  expect(result.current.stateOf('t1')).toEqual({ kind: 'admitted', at: '2026-10-13T18:42:00Z' });
  expect(result.current.stateOf('t2')).toMatchObject({ kind: 'live', token: 'A2' });
  await advance(28_000);
  expect(result.current.stateOf('t2')).toEqual({ kind: 'admitted', at: '2026-10-13T18:43:00Z' });
  await advance(120_000);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  await unmount();
});

it('a deploy without the route (bare 404) hands over to per-ticket polling, for good', async () => {
  fetchCodes.mockResolvedValue(ok(FALLBACK));
  const { result, rerender, unmount } = await run();
  expect(result.current.perTicket).toBe(true);
  await advance(120_000);
  await rerender({ id: 'e1', on: false });
  await rerender({ id: 'e1', on: true });
  await advance(0);
  expect(fetchCodes).toHaveBeenCalledTimes(1);
  await unmount();
});

it('keeps the last tokens through a 429 until the server would refuse them', async () => {
  fetchCodes
    .mockImplementationOnce(live('A1'))
    .mockResolvedValueOnce(fail({ kind: 'rateLimited', retryAfterSec: 60 }))
    .mockImplementationOnce(live('C1'));
  const { result, unmount } = await run();
  await advance(28_000);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  expect(result.current.stateOf('t1')).toMatchObject({
    kind: 'rateLimited',
    last: { token: 'A1' },
  });
  // A1 expires at 30 s; the server accepts it one more step (until 60 s).
  await advance(31_999);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'rateLimited' });
  await advance(1);
  expect(result.current.stateOf('t1')).toEqual({ kind: 'fallback' });
  // Retry-After 60 s from the 429 at 28 s.
  await advance(27_999);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  await advance(1);
  expect(fetchCodes).toHaveBeenCalledTimes(3);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'live', token: 'C1' });
  await unmount();
});

it('a transient failure keeps usable tokens, then retries after 15 s', async () => {
  fetchCodes
    .mockImplementationOnce(live('A1'))
    .mockResolvedValueOnce(fail({ kind: 'network' }))
    .mockImplementationOnce(live('C1'));
  const { result, unmount } = await run();
  await advance(28_000);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'live', token: 'A1' });
  await advance(REFRESH_AFTER_ERROR_MS);
  expect(fetchCodes).toHaveBeenCalledTimes(3);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'live', token: 'C1' });
  await unmount();
});

it('with nothing usable, a failure is the fallback (never a refusal)', async () => {
  fetchCodes.mockResolvedValue(fail({ kind: 'timeout' }));
  const { result, unmount } = await run();
  expect(result.current.stateOf('t1')).toEqual({ kind: 'fallback' });
  await unmount();
});

it('401 is signed out and stops; reopening asks again', async () => {
  fetchCodes.mockResolvedValueOnce(fail({ kind: 'auth' })).mockImplementationOnce(live('A1'));
  const { result, rerender, unmount } = await run();
  expect(result.current.stateOf('t1')).toEqual({ kind: 'signedOut' });
  await advance(120_000);
  expect(fetchCodes).toHaveBeenCalledTimes(1);
  await rerender({ id: 'e1', on: false });
  await rerender({ id: 'e1', on: true });
  await advance(0);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'live', token: 'A1' });
  await unmount();
});

it('closed: no polling; reopened before the refresh time, it resumes without fetching', async () => {
  fetchCodes.mockImplementation(live('A1'));
  const { result, rerender, unmount } = await run();
  await rerender({ id: 'e1', on: false });
  await advance(60_000);
  expect(fetchCodes).toHaveBeenCalledTimes(1);
  // Overdue now: fetches at once.
  await rerender({ id: 'e1', on: true });
  await advance(0);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  await rerender({ id: 'e1', on: false });
  await advance(5_000);
  await rerender({ id: 'e1', on: true });
  await advance(0);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'live', token: 'A1' });
  await unmount();
});

it('pauses in the background and resumes in the foreground', async () => {
  fetchCodes.mockImplementation(live('A1'));
  const { unmount } = await run();
  await act(() => {
    AppState.currentState = 'background';
    onAppState?.('background');
  });
  await advance(120_000);
  expect(fetchCodes).toHaveBeenCalledTimes(1);
  await act(() => {
    AppState.currentState = 'active';
    onAppState?.('active');
  });
  await advance(0);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  await unmount();
});

it('no booking, or inactive: no request', async () => {
  const a = await run(null, true);
  const b = await run('e1', false);
  expect(fetchCodes).not.toHaveBeenCalled();
  expect(a.result.current.stateOf('t1')).toEqual({ kind: 'loading' });
  await a.unmount();
  await b.unmount();
});

it('Try again fetches now', async () => {
  fetchCodes.mockResolvedValueOnce(fail({ kind: 'network' })).mockImplementationOnce(live('A1'));
  const { result, unmount } = await run();
  expect(result.current.stateOf('t1')).toEqual({ kind: 'fallback' });
  await act(() => {
    result.current.retry();
  });
  await advance(0);
  expect(fetchCodes).toHaveBeenCalledTimes(2);
  expect(result.current.stateOf('t1')).toMatchObject({ kind: 'live', token: 'A1' });
  await unmount();
});
