import { act, renderHook } from '@testing-library/react-native';

import { freshnessLabel, useFreshness } from '@/features/receptionist/hooks/useFreshness';

let mockFocused = true;
jest.mock('expo-router', () => ({ useIsFocused: () => mockFocused }));

const T0 = 1_760_000_000_000;

beforeEach(() => {
  mockFocused = true;
  jest.useFakeTimers();
  jest.setSystemTime(T0);
});
afterEach(() => {
  jest.useRealTimers();
});

it('labels only data older than two minutes', () => {
  expect(freshnessLabel(0, T0)).toBeNull();
  expect(freshnessLabel(T0 - 60_000, T0)).toBeNull();
  expect(freshnessLabel(T0 - 119_000, T0)).toBeNull();
  expect(freshnessLabel(T0 - 120_000, T0)).toBe('Updated 2 min ago');
  expect(freshnessLabel(T0 - 3 * 60_000, T0)).toBe('Updated 3 min ago');
});

it('is null at one minute and re-evaluates to "Updated 3 min ago" as time passes', async () => {
  const hook = await renderHook(({ at }: { at: number }) => useFreshness(at), {
    initialProps: { at: 0 },
  });
  expect(hook.result.current).toBeNull();

  await hook.rerender({ at: T0 });
  await act(() => {
    jest.advanceTimersByTime(60_000);
  });
  expect(hook.result.current).toBeNull();

  await act(() => {
    jest.advanceTimersByTime(2 * 60_000);
  });
  expect(hook.result.current).toBe('Updated 3 min ago');

  // A fresh load clears the line at once.
  await hook.rerender({ at: T0 + 3 * 60_000 });
  expect(hook.result.current).toBeNull();
  await hook.unmount();
});

it('does not tick while the screen is out of focus, and catches up on return', async () => {
  const hook = await renderHook(({ at }: { at: number }) => useFreshness(at), {
    initialProps: { at: T0 },
  });
  mockFocused = false;
  await hook.rerender({ at: T0 });
  await act(() => {
    jest.advanceTimersByTime(5 * 60_000);
  });
  // A running tick would read "Updated 5 min ago" by now.
  expect(hook.result.current).toBeNull();

  mockFocused = true;
  await hook.rerender({ at: T0 });
  await act(() => {
    jest.advanceTimersByTime(0);
  });
  expect(hook.result.current).toBe('Updated 5 min ago');
  await hook.unmount();
});
