import { renderHook } from '@testing-library/react-native';
import * as ScreenCapture from 'expo-screen-capture';

import { usePreventCapture } from '@/shared/platform/usePreventCapture';

// Focus is the screen's mount here: run the effect and its cleanup like React would.
jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    useFocusEffect: (cb: () => () => void) => {
      useEffect(cb, [cb]);
    },
  };
});
jest.mock('expo-screen-capture', () => ({
  preventScreenCaptureAsync: jest.fn(() => Promise.resolve()),
  allowScreenCaptureAsync: jest.fn(() => Promise.resolve()),
}));

const capture = jest.mocked(ScreenCapture);

beforeEach(() => {
  jest.clearAllMocks();
});

it('blocks capture under its key while focused and allows it again on blur', async () => {
  const { unmount } = await renderHook(() => {
    usePreventCapture('ticket-qr');
  });
  expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith('ticket-qr');
  expect(capture.allowScreenCaptureAsync).not.toHaveBeenCalled();
  await unmount();
  expect(capture.allowScreenCaptureAsync).toHaveBeenCalledWith('ticket-qr');
});

it('a native failure is swallowed (the code still shows)', async () => {
  capture.preventScreenCaptureAsync.mockRejectedValueOnce(new Error('unavailable'));
  await renderHook(() => {
    usePreventCapture('checkin-code');
  });
  expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith('checkin-code');
});
