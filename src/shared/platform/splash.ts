import * as SplashScreen from 'expo-splash-screen';

let hidden = false;

/**
 * Hides the native splash once; later calls are no-ops, and a rejected hide (already hidden by
 * the OS) is not an unhandled promise. Shared so the opening screen can hide it the moment its
 * identical first frame is on screen.
 */
export function hideSplashOnce(): void {
  if (hidden) return;
  hidden = true;
  SplashScreen.hideAsync().catch(() => undefined);
}
