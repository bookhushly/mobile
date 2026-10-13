import * as Brightness from 'expo-brightness';
import { Platform } from 'react-native';

import { raiseBrightness } from '@/shared/platform/brightness';

jest.mock('expo-brightness', () => ({
  getBrightnessAsync: jest.fn(),
  setBrightnessAsync: jest.fn(),
  restoreSystemBrightnessAsync: jest.fn(),
  setSystemBrightnessAsync: jest.fn(),
}));

const b = jest.mocked(Brightness);
const realOS = Platform.OS;

function setOS(os: typeof Platform.OS) {
  Object.defineProperty(Platform, 'OS', { configurable: true, get: () => os });
}

beforeEach(() => {
  jest.resetAllMocks();
  b.getBrightnessAsync.mockResolvedValue(0.4);
  b.setBrightnessAsync.mockResolvedValue();
  b.restoreSystemBrightnessAsync.mockResolvedValue();
});
afterAll(() => {
  setOS(realOS);
});

it('on iOS raises to full and restores the value read beforehand', async () => {
  setOS('ios');
  const restore = await raiseBrightness();
  expect(b.setBrightnessAsync).toHaveBeenLastCalledWith(1);
  await restore();
  expect(b.setBrightnessAsync).toHaveBeenLastCalledWith(0.4);
  expect(b.restoreSystemBrightnessAsync).not.toHaveBeenCalled();
  expect(b.setSystemBrightnessAsync).not.toHaveBeenCalled();
});

it('on Android raises to full and hands control back to the system', async () => {
  setOS('android');
  const restore = await raiseBrightness();
  expect(b.setBrightnessAsync).toHaveBeenCalledWith(1);
  await restore();
  expect(b.restoreSystemBrightnessAsync).toHaveBeenCalledTimes(1);
  expect(b.setSystemBrightnessAsync).not.toHaveBeenCalled();
});

it('never throws when the native module fails', async () => {
  setOS('ios');
  b.getBrightnessAsync.mockRejectedValue(new Error('unavailable'));
  const restore = await raiseBrightness();
  await expect(restore()).resolves.toBeUndefined();

  b.getBrightnessAsync.mockResolvedValue(0.4);
  const restore2 = await raiseBrightness();
  b.setBrightnessAsync.mockRejectedValue(new Error('gone'));
  await expect(restore2()).resolves.toBeUndefined();

  setOS('android');
  b.setBrightnessAsync.mockResolvedValue();
  b.restoreSystemBrightnessAsync.mockRejectedValue(new Error('gone'));
  const restore3 = await raiseBrightness();
  await expect(restore3()).resolves.toBeUndefined();
});
