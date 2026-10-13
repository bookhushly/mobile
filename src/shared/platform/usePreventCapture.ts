import { useFocusEffect } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useCallback } from 'react';

const ignore = () => {};

// Blocks screenshots and screen recording (blank in recordings and the app switcher on Android;
// iOS hides the content from captures) while this screen is focused, so a live code can't be
// passed around as a picture. `key` lets several screens hold the block independently. No
// screenshot listener, so no extra permissions.
export function usePreventCapture(key: string): void {
  useFocusEffect(
    // useCallback: useFocusEffect re-runs whenever the callback identity changes.
    useCallback(() => {
      ScreenCapture.preventScreenCaptureAsync(key).catch(ignore);
      return () => {
        ScreenCapture.allowScreenCaptureAsync(key).catch(ignore);
      };
    }, [key]),
  );
}
