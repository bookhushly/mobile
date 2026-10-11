import { renderHook } from '@testing-library/react-native';
import { Dimensions } from 'react-native';

import { useWide } from '@/shared/ui/useWide';

afterEach(() => {
  jest.restoreAllMocks();
});

// useWindowDimensions reads Dimensions.get('window') at mount; react-native's index exposes the
// hook through a lazy getter, so the dimensions are stubbed rather than the hook itself.
const stubWidth = (width: number) => {
  jest
    .spyOn(Dimensions, 'get')
    .mockReturnValue({ width, height: 1000, scale: 2, fontScale: 1 });
};

it('is narrow on a phone', async () => {
  stubWidth(390);
  const { result } = await renderHook(() => useWide());
  expect(result.current).toBe(false);
});

it('is wide from 768 pt (tablet two-pane)', async () => {
  stubWidth(768);
  const { result } = await renderHook(() => useWide());
  expect(result.current).toBe(true);
});
