import { useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback } from 'react';
import { Platform } from 'react-native';

const ignore = () => {};

// iOS: blur the app-switcher snapshot too. The overlay is app-wide (not keyed), so it is
// counted: on while any protected screen is focused, off when the last one blurs.
let switcherHolds = 0;

function guarded(run: () => Promise<void>): void {
  try {
    run().catch(ignore);
  } catch {
    // unavailable on this device/OS: the code still shows
  }
}

function holdSwitcher(): void {
  if (Platform.OS !== 'ios') return;
  switcherHolds += 1;
  if (switcherHolds === 1) guarded(() => ScreenCapture.enableAppSwitcherProtectionAsync());
}

function releaseSwitcher(): void {
  if (Platform.OS !== 'ios' || switcherHolds === 0) return;
  switcherHolds -= 1;
  if (switcherHolds === 0) guarded(() => ScreenCapture.disableAppSwitcherProtectionAsync());
}

// Blocks screenshots and screen recording (blank in recordings and the app switcher on Android;
// iOS hides the content from captures and blurs the app-switcher snapshot) while this screen is
// focused, so a live code can't be passed around as a picture. `key` lets several screens hold
// the block independently. No screenshot listener, so no extra permissions.
export function usePreventCapture(key: string): void {
  useFocusEffect(
    // useCallback: useFocusEffect re-runs whenever the callback identity changes.
    useCallback(() => {
      guarded(() => ScreenCapture.preventScreenCaptureAsync(key));
      holdSwitcher();
      return () => {
        guarded(() => ScreenCapture.allowScreenCaptureAsync(key));
        releaseSwitcher();
      };
    }, [key]),
  );
}
