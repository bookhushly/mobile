import { renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Dimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useTabBarPad } from '@/shared/ui/useTabBarPad';

afterEach(() => {
  jest.restoreAllMocks();
});

const stubFontScale = (fontScale: number) => {
  jest.spyOn(Dimensions, 'get').mockReturnValue({ width: 375, height: 667, scale: 2, fontScale });
};

const withBottomInset = (bottom: number) =>
  function Insets({ children }: { children: ReactNode }) {
    return (
      <SafeAreaProvider
        initialMetrics={{
          frame: { x: 0, y: 0, width: 375, height: 667 },
          insets: { top: 20, left: 0, bottom, right: 0 },
        }}
      >
        {children}
      </SafeAreaProvider>
    );
  };

it('leaves phones with a home indicator to the router’s own sizing', async () => {
  stubFontScale(1);
  const { result } = await renderHook(() => useTabBarPad(1.3), { wrapper: withBottomInset(34) });
  expect(result.current).toBeNull();
});

it('gives a home-button phone room under the labels', async () => {
  stubFontScale(1);
  const { result } = await renderHook(() => useTabBarPad(1.3), { wrapper: withBottomInset(0) });
  expect(result.current).toEqual({ height: 57, paddingBottom: 8 });
});

it('grows with larger text, but only up to the label’s cap', async () => {
  stubFontScale(1.3);
  const capped = await renderHook(() => useTabBarPad(1.3), { wrapper: withBottomInset(0) });
  stubFontScale(3);
  const huge = await renderHook(() => useTabBarPad(1.3), { wrapper: withBottomInset(0) });
  const pad = capped.result.current?.paddingBottom ?? 0;
  expect(pad).toBeGreaterThan(8);
  expect(huge.result.current?.paddingBottom).toBe(pad);
});
