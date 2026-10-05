import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useAppActive } from '@/features/gate/ui/ScannerCamera';

jest.mock('expo-camera', () => ({
  CameraView: () => null,
  PermissionStatus: { UNDETERMINED: 'undetermined' },
  useCameraPermissions: () => [null, jest.fn(), jest.fn()],
}));

const remove = jest.fn();
let listener: ((s: AppStateStatus) => void) | null = null;

beforeEach(() => {
  listener = null;
  remove.mockClear();
  AppState.currentState = 'active';
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    listener = cb;
    return { remove };
  });
});

it('is false while the app is in the background and true again on return', async () => {
  const { result, unmount } = await renderHook(() => useAppActive());
  expect(result.current).toBe(true);
  await act(() => {
    listener?.('background');
  });
  expect(result.current).toBe(false);
  await act(() => {
    listener?.('active');
  });
  expect(result.current).toBe(true);
  await unmount();
  expect(remove).toHaveBeenCalled();
});
