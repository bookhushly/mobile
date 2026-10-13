import { renderHook } from '@testing-library/react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { Platform } from 'react-native';

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
  enableAppSwitcherProtectionAsync: jest.fn(() => Promise.resolve()),
  disableAppSwitcherProtectionAsync: jest.fn(() => Promise.resolve()),
}));

const capture = jest.mocked(ScreenCapture);

const realOs = Platform.OS;

beforeEach(() => {
  jest.clearAllMocks();
  Platform.OS = 'ios';
});

afterAll(() => {
  Platform.OS = realOs;
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

it('iOS: blurs the app switcher while focused and stops on blur', async () => {
  const { unmount } = await renderHook(() => {
    usePreventCapture('ticket-qr');
  });
  expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
  expect(capture.disableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
  await unmount();
  expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
});

it('iOS: the switcher stays protected until the last protected screen blurs', async () => {
  const a = await renderHook(() => {
    usePreventCapture('ticket-qr');
  });
  const b = await renderHook(() => {
    usePreventCapture('checkin-code');
  });
  expect(capture.enableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
  await a.unmount();
  expect(capture.disableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
  await b.unmount();
  expect(capture.disableAppSwitcherProtectionAsync).toHaveBeenCalledTimes(1);
});

it('iOS: a switcher failure (thrown or rejected) is swallowed', async () => {
  capture.enableAppSwitcherProtectionAsync.mockImplementationOnce(() => {
    throw new Error('unavailable');
  });
  const { unmount } = await renderHook(() => {
    usePreventCapture('ticket-qr');
  });
  capture.disableAppSwitcherProtectionAsync.mockRejectedValueOnce(new Error('unavailable'));
  await unmount();
  expect(capture.preventScreenCaptureAsync).toHaveBeenCalledWith('ticket-qr');
});

it('Android: no app-switcher calls (the capture block already blanks it)', async () => {
  Platform.OS = 'android';
  const { unmount } = await renderHook(() => {
    usePreventCapture('ticket-qr');
  });
  await unmount();
  expect(capture.enableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
  expect(capture.disableAppSwitcherProtectionAsync).not.toHaveBeenCalled();
});
