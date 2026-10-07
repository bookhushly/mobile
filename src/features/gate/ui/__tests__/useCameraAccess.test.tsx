import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';

import { useCameraAccess } from '@/features/gate/ui/ScannerCamera';

type Perm = { granted: boolean; canAskAgain: boolean; status: string } | null;

const mockState: { perm: Perm; get: jest.Mock; request: jest.Mock } = {
  perm: null,
  get: jest.fn(),
  request: jest.fn(),
};

jest.mock('expo-camera', () => {
  const { useState, useCallback } = jest.requireActual<typeof import('react')>('react');
  return {
    CameraView: () => null,
    PermissionStatus: { UNDETERMINED: 'undetermined', GRANTED: 'granted', DENIED: 'denied' },
    useCameraPermissions: () => {
      const [perm, setPerm] = useState<Perm>(mockState.perm);
      const get = useCallback(async () => {
        const next = (await mockState.get()) as Perm;
        setPerm(next);
        return next;
      }, []);
      return [perm, mockState.request, get];
    },
  };
});

const remove = jest.fn();
let listener: ((s: AppStateStatus) => void) | null = null;

beforeEach(() => {
  jest.clearAllMocks();
  listener = null;
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_t, cb) => {
    listener = cb;
    return { remove };
  });
});

it('re-reads the permission when the app returns to the foreground', async () => {
  mockState.perm = { granted: false, canAskAgain: false, status: 'denied' };
  mockState.get.mockResolvedValue({ granted: true, canAskAgain: true, status: 'granted' });
  const { result, unmount } = await renderHook(() => useCameraAccess());
  expect(result.current.permission).toBe('denied');
  await act(() => {
    listener?.('background');
  });
  expect(mockState.get).not.toHaveBeenCalled();
  await act(() => {
    listener?.('active');
  });
  expect(mockState.get).toHaveBeenCalledTimes(1);
  expect(result.current.permission).toBe('granted');
  await unmount();
  expect(remove).toHaveBeenCalled();
});

it('treats an undetermined permission as unknown, not denied', async () => {
  mockState.perm = { granted: false, canAskAgain: true, status: 'undetermined' };
  const { result } = await renderHook(() => useCameraAccess());
  expect(result.current.permission).toBe('unknown');
});

it('reports denied only once the user has refused', async () => {
  mockState.perm = { granted: false, canAskAgain: true, status: 'denied' };
  const { result } = await renderHook(() => useCameraAccess());
  expect(result.current.permission).toBe('denied');
});
