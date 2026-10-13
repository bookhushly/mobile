import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import type { ModeInputs } from '@/features/mode/domain/resolveMode';
import { resolveRoute } from '@/features/mode/domain/route';
import { useModeState } from '@/features/mode/hooks/useModeState';
import type { ApiError } from '@/shared/lib/errors';
import type { memoryKv } from '@/shared/lib/kv';
import { err, ok, type Result } from '@/shared/lib/result';
import { runAlwaysWipes } from '@/shared/lib/signOutGuard';

jest.mock('@/shared/platform/storage', () => {
  const { memoryKv: make } =
    jest.requireActual<typeof import('@/shared/lib/kv')>('@/shared/lib/kv');
  return { plainKv: make() };
});
const mockKv = jest.requireMock<{ plainKv: ReturnType<typeof memoryKv> }>(
  '@/shared/platform/storage',
).plainKv;
jest.mock('@/shared/supabase/client', () => ({ supabase: {} }));
jest.mock('@/shared/supabase/scannerDb', () => ({ scannerDb: {} }));
const mockLoad = jest.fn<Promise<Result<ModeInputs, ApiError>>, []>();
jest.mock('@/features/mode/api/loadModeInputs', () => ({
  loadModeInputs: () => mockLoad(),
}));

const customer: ModeInputs = { role: 'customer', hotelStaff: null, activeScannerCount: 0 };
const staffCustomer: ModeInputs = { role: 'customer', hotelStaff: null, activeScannerCount: 2 };

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function routeOf(r: { current: ReturnType<typeof useModeState> }) {
  return resolveRoute({
    versionOk: true,
    auth: 'signedIn',
    mode: r.current.state,
    chosenMode: r.current.chosen,
    recovery: false,
  });
}

beforeEach(async () => {
  // Fake timers: TanStack's batched notify timer only runs inside waitFor()/act(), never between
  // a test's last assertion and its teardown.
  jest.useFakeTimers();
  await runAlwaysWipes();
  for (const k of Object.keys(mockKv.dump())) await mockKv.delete(k);
  mockLoad.mockReset();
  onlineManager.setOnline(true);
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
});

// Unmount first, then clear the client and flush pending timers inside act(): nothing may
// update a hook after its test has ended.
afterEach(async () => {
  await cleanup();
  client.clear();
  onlineManager.setOnline(true);
  await act(async () => {
    await jest.runOnlyPendingTimersAsync();
  });
  jest.useRealTimers();
});

async function seedCache(userId: string, inputs: ModeInputs) {
  mockLoad.mockResolvedValueOnce(ok(inputs));
  const first = await renderHook(() => useModeState(userId), { wrapper });
  await waitFor(() => {
    expect(first.result.current.state.status).toBe('ready');
  });
  await waitFor(() => {
    expect(mockKv.dump()[`bh.mode.last.${userId}`]).toBeDefined();
  });
  await first.unmount();
  client.clear();
}

it('saves the resolution on success (modes and default only)', async () => {
  await seedCache('u-save', staffCustomer);
  expect(JSON.parse(mockKv.dump()['bh.mode.last.u-save'] ?? '')).toEqual({
    modes: ['gate', 'customer'],
    defaultMode: 'gate',
  });
});

it('offline cold start with a cached resolution -> the customer route', async () => {
  await seedCache('u1', customer);
  onlineManager.setOnline(false);
  const { result } = await renderHook(() => useModeState('u1'), { wrapper });
  await waitFor(() => {
    expect(routeOf(result)).toBe('customer');
  });
  expect(mockLoad).toHaveBeenCalledTimes(1); // only the seeding run: the live lookup is paused
});

it('offline cold start with a cached gate resolution -> the gate route', async () => {
  await seedCache('u-gate', staffCustomer);
  onlineManager.setOnline(false);
  const { result } = await renderHook(() => useModeState('u-gate'), { wrapper });
  await waitFor(() => {
    expect(routeOf(result)).toBe('gate');
  });
});

it('offline cold start without a cache keeps loading', async () => {
  onlineManager.setOnline(false);
  const { result } = await renderHook(() => useModeState('u2'), { wrapper });
  await act(async () => {
    await Promise.resolve();
  });
  expect(routeOf(result)).toBe('loading');
});

it('a transient failure with a cache -> the cached mode', async () => {
  await seedCache('u3', customer);
  mockLoad.mockResolvedValueOnce(err({ kind: 'network' }));
  const { result } = await renderHook(() => useModeState('u3'), { wrapper });
  await waitFor(() => {
    expect(routeOf(result)).toBe('customer');
  });
});

it('a transient failure without a cache -> mode error', async () => {
  mockLoad.mockResolvedValueOnce(err({ kind: 'unavailable', status: 503 }));
  const { result } = await renderHook(() => useModeState('u4'), { wrapper });
  await waitFor(() => {
    expect(routeOf(result)).toBe('modeError');
  });
});

it('a non-transient failure shows the error even with a cache', async () => {
  await seedCache('u5', customer);
  mockLoad.mockResolvedValueOnce(err({ kind: 'forbidden' }));
  const { result } = await renderHook(() => useModeState('u5'), { wrapper });
  await waitFor(() => {
    expect(routeOf(result)).toBe('modeError');
  });
});

it('sign-out (the always-wipes) deletes the cached resolution', async () => {
  await seedCache('u6', customer);
  await runAlwaysWipes();
  expect(mockKv.dump()['bh.mode.last.u6']).toBeUndefined();
});
