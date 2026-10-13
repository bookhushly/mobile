import { act, renderHook } from '@testing-library/react-native';
import * as KeepAwake from 'expo-keep-awake';
import { AppState, type AppStateStatus } from 'react-native';

import { raiseBrightness } from '@/shared/platform/brightness';
import { useBrightScreen } from '@/shared/platform/useBrightScreen';

jest.mock('expo-keep-awake', () => ({
  activateKeepAwakeAsync: jest.fn(() => Promise.resolve()),
  deactivateKeepAwake: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-brightness', () => ({}));
jest.mock('@/shared/platform/brightness', () => ({ raiseBrightness: jest.fn() }));

const keep = jest.mocked(KeepAwake);
const raise = jest.mocked(raiseBrightness);
const restore = jest.fn(() => Promise.resolve());
const remove = jest.fn();
let listener: ((s: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  listener = null;
  raise.mockResolvedValue(restore);
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    listener = cb;
    return { remove };
  });
});

const flush = () =>
  act(async () => {
    await Promise.resolve();
  });

it('keeps the screen awake and bright while active, and undoes both on unmount', async () => {
  const { unmount } = await renderHook(() => {
    useBrightScreen(true);
  });
  await flush();
  expect(raise).toHaveBeenCalledTimes(1);
  expect(keep.activateKeepAwakeAsync).toHaveBeenCalledTimes(1);
  const tag = keep.activateKeepAwakeAsync.mock.calls[0]?.[0];
  expect(typeof tag).toBe('string');
  await unmount();
  await flush();
  expect(restore).toHaveBeenCalledTimes(1);
  expect(keep.deactivateKeepAwake).toHaveBeenCalledWith(tag);
  expect(remove).toHaveBeenCalled();
});

it('does nothing while inactive, and restores when it turns inactive', async () => {
  const { rerender } = await renderHook(
    ({ on }: { on: boolean }) => {
      useBrightScreen(on);
    },
    {
      initialProps: { on: false },
    },
  );
  await flush();
  expect(raise).not.toHaveBeenCalled();
  expect(keep.activateKeepAwakeAsync).not.toHaveBeenCalled();
  await rerender({ on: true });
  await flush();
  expect(raise).toHaveBeenCalledTimes(1);
  await rerender({ on: false });
  await flush();
  expect(restore).toHaveBeenCalledTimes(1);
  expect(keep.deactivateKeepAwake).toHaveBeenCalledTimes(1);
});

it('restores in the background and raises again on return', async () => {
  await renderHook(() => {
    useBrightScreen(true);
  });
  await flush();
  await act(() => {
    listener?.('background');
  });
  await flush();
  expect(restore).toHaveBeenCalledTimes(1);
  expect(keep.deactivateKeepAwake).toHaveBeenCalledTimes(1);
  await act(() => {
    listener?.('active');
  });
  await flush();
  expect(raise).toHaveBeenCalledTimes(2);
  expect(keep.activateKeepAwakeAsync).toHaveBeenCalledTimes(2);
});

it('restores as soon as a raise resolves when cleanup ran first', async () => {
  let resolveRaise: (r: () => Promise<void>) => void = () => {};
  raise.mockReturnValueOnce(
    new Promise((res) => {
      resolveRaise = res;
    }),
  );
  const { unmount } = await renderHook(() => {
    useBrightScreen(true);
  });
  await unmount();
  await flush();
  expect(restore).not.toHaveBeenCalled();
  await act(async () => {
    resolveRaise(restore);
    await Promise.resolve();
  });
  expect(restore).toHaveBeenCalledTimes(1);
});

it('raises only after the previous restore has finished (no interleaving)', async () => {
  let finishRestore: () => void = () => {};
  restore.mockImplementationOnce(
    () =>
      new Promise<void>((res) => {
        finishRestore = res;
      }),
  );
  const { rerender } = await renderHook(
    ({ on }: { on: boolean }) => {
      useBrightScreen(on);
    },
    {
      initialProps: { on: true },
    },
  );
  await flush();
  await rerender({ on: false });
  await rerender({ on: true });
  await flush();
  expect(raise).toHaveBeenCalledTimes(1);
  await act(async () => {
    finishRestore();
    await Promise.resolve();
  });
  expect(raise).toHaveBeenCalledTimes(2);
});
