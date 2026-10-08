import { act, renderHook, waitFor } from '@testing-library/react-native';

import { gateDb, hasGateDb } from '@/features/gate/offline/gateDb';
import { useOfflineLists } from '@/features/gate/hooks/useOfflineLists';
import { captureException } from '@/shared/monitoring';

jest.mock('@/features/gate/offline/gateDb', () => ({ gateDb: jest.fn(), hasGateDb: jest.fn() }));
jest.mock('@/shared/monitoring', () => ({ captureException: jest.fn() }));

const mockHas = jest.mocked(hasGateDb);
const mockDb = jest.mocked(gateDb);
const mockCapture = jest.mocked(captureException);
const USER = 'u1';

const dbWith = (ids: string[]) =>
  ({ roster: { readyEventIds: jest.fn().mockResolvedValue(ids) } }) as unknown as Awaited<
    ReturnType<typeof gateDb>
  >;

beforeEach(() => {
  jest.clearAllMocks();
});

it('is empty without a gate database', async () => {
  mockHas.mockResolvedValue(false);
  const hook = await renderHook(() => useOfflineLists(USER, true));
  await waitFor(() => {
    expect(mockHas).toHaveBeenCalledWith(USER);
  });
  expect(hook.result.current.lists.size).toBe(0);
  expect(mockDb).not.toHaveBeenCalled();
});

it('a read failure yields an empty set and is reported', async () => {
  mockHas.mockResolvedValue(true);
  mockDb.mockRejectedValue(new Error('locked'));
  const hook = await renderHook(() => useOfflineLists(USER, true));
  await waitFor(() => {
    expect(mockCapture).toHaveBeenCalledTimes(1);
  });
  expect(hook.result.current.lists.size).toBe(0);
});

it('re-reads on reload and on regaining focus, picking up a newly ready list', async () => {
  mockHas.mockResolvedValue(false);
  const hook = await renderHook(
    ({ focused }: { focused: boolean }) => useOfflineLists(USER, focused),
    {
      initialProps: { focused: true },
    },
  );
  await waitFor(() => {
    expect(mockHas).toHaveBeenCalledTimes(1);
  });
  expect(hook.result.current.lists.has('e1')).toBe(false);

  // The list downloads on the detail screen; the DB now exists and e1 is ready.
  mockHas.mockResolvedValue(true);
  mockDb.mockResolvedValue(dbWith(['e1']));
  await act(() => {
    hook.result.current.reload();
  });
  await waitFor(() => {
    expect(hook.result.current.lists.has('e1')).toBe(true);
  });

  // Leaving the screen does not re-read; coming back does.
  mockDb.mockResolvedValue(dbWith(['e1', 'e2']));
  await hook.rerender({ focused: false });
  expect(mockDb).toHaveBeenCalledTimes(1);
  await hook.rerender({ focused: true });
  await waitFor(() => {
    expect(hook.result.current.lists.has('e2')).toBe(true);
  });
});

it('does not read while unfocused or signed out', async () => {
  mockHas.mockResolvedValue(true);
  await renderHook(() => useOfflineLists(USER, false));
  await renderHook(() => useOfflineLists(null, true));
  expect(mockHas).not.toHaveBeenCalled();
});
