import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { mapsUrl } from '@/features/customer/domain/detailText';

export const WEB_HOME = 'https://bookhushly.com';
// C5: pending bookings are paid for on the web (payment in the app is 4c).
export const WEB_DASHBOARD = 'https://bookhushly.com/dashboard/customer';

/** In-app browser; a failure to open leaves the user where they are. */
export function openWeb(url: string): void {
  void WebBrowser.openBrowserAsync(url).catch(() => undefined);
}

export function openMaps(query: string): void {
  void Linking.openURL(mapsUrl(query, Platform.OS)).catch(() => undefined);
}
