import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import {
  readNotificationPermission,
  requestNotificationPermission,
} from '@/shared/platform/notificationPermission';

const get = jest.mocked(Notifications.getPermissionsAsync);
const request = jest.mocked(Notifications.requestPermissionsAsync);
const channel = jest.mocked(Notifications.setNotificationChannelAsync);

type Status = Awaited<ReturnType<typeof Notifications.getPermissionsAsync>>;
const status = (s: Partial<Status>) => s as Status;

afterEach(() => {
  jest.clearAllMocks();
});

it('trusts iOS’s own status: not asked, denied, provisional', async () => {
  get.mockResolvedValueOnce(
    status({
      ios: { status: Notifications.IosAuthorizationStatus.NOT_DETERMINED } as Status['ios'],
    }),
  );
  expect(await readNotificationPermission()).toBe('undetermined');
  get.mockResolvedValueOnce(
    status({ ios: { status: Notifications.IosAuthorizationStatus.DENIED } as Status['ios'] }),
  );
  expect(await readNotificationPermission()).toBe('denied');
  get.mockResolvedValueOnce(
    status({ ios: { status: Notifications.IosAuthorizationStatus.PROVISIONAL } as Status['ios'] }),
  );
  expect(await readNotificationPermission()).toBe('granted');
});

it('on Android, someone who declined but can be asked again is still askable', async () => {
  get.mockResolvedValueOnce(
    status({ status: Notifications.PermissionStatus.DENIED, granted: false, canAskAgain: true }),
  );
  expect(await readNotificationPermission()).toBe('undetermined');
  get.mockResolvedValueOnce(
    status({ status: Notifications.PermissionStatus.DENIED, granted: false, canAskAgain: false }),
  );
  expect(await readNotificationPermission()).toBe('denied');
});

it('a failed read counts as already asked, so nothing prompts', async () => {
  get.mockRejectedValueOnce(new Error('native'));
  expect(await readNotificationPermission()).toBe('denied');
});

it('Android makes a channel before asking, or the prompt never shows', async () => {
  const os = Platform.OS;
  Object.defineProperty(Platform, 'OS', { value: 'android', configurable: true });
  await requestNotificationPermission();
  expect(channel).toHaveBeenCalledWith(
    'default',
    expect.objectContaining({ name: 'Bookings and tickets' }),
  );
  expect(channel.mock.invocationCallOrder[0]).toBeLessThan(
    request.mock.invocationCallOrder[0] ?? 0,
  );
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
});
