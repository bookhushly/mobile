import { act, renderHook } from '@testing-library/react-native';

import { freshnessLabel, useFreshness } from '@/features/receptionist/hooks/useFreshness';

const T0 = 1_760_000_000_000;

beforeEach(() => {
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
