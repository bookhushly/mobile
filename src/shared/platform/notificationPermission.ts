import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

export type NotificationPermission = 'undetermined' | 'granted' | 'denied';

// iOS reports the real answer in `ios.status` (docs: check it rather than the root status);
// provisional and ephemeral both deliver, so they count as granted.
function read(p: Notifications.NotificationPermissionsStatus): NotificationPermission {
  const ios = p.ios?.status;
  if (ios !== undefined) {
    if (ios === Notifications.IosAuthorizationStatus.NOT_DETERMINED) return 'undetermined';
    if (ios === Notifications.IosAuthorizationStatus.DENIED) return 'denied';
    return 'granted';
  }
  if (p.granted) return 'granted';
  // Android: a person who declined once can still be asked while canAskAgain holds.
  return p.status === Notifications.PermissionStatus.UNDETERMINED || p.canAskAgain
    ? 'undetermined'
    : 'denied';
}

/** Reads the current answer without showing anything. A failed read counts as already asked. */
export async function readNotificationPermission(): Promise<NotificationPermission> {
  try {
    return read(await Notifications.getPermissionsAsync());
  } catch {
    return 'denied';
  }
}

/**
 * Shows the system prompt. Android 13+ shows nothing until a channel exists, so one is made first
 * (SDK 57 docs). Permission only: no push token is registered until the backend can take one
 * (BACKEND-REQ-5).
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Bookings and tickets',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }
    return read(await Notifications.requestPermissionsAsync());
  } catch {
    return 'denied';
  }
}
