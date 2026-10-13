import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useId, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { raiseBrightness } from './brightness';

const ignore = () => {};

// While `active` and the app is in the foreground, keeps the screen awake and at full brightness
// so a QR code scans at the door. Undone when `active` turns false, on unmount and in the
// background; redone on return.
export function useBrightScreen(active: boolean): void {
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setAppState);
    return () => {
      sub.remove();
    };
  }, []);

  const tag = `bright-screen${useId()}`;
  // Brightness raises and restores run one after another, so a restore always resolves before the
  // next raise reads the level (iOS), and a cleanup that beats its raise restores once it lands.
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const on = active && appState !== 'background';

  useEffect(() => {
    if (!on) return;
    activateKeepAwakeAsync(tag).catch(ignore);
    const raised = queue.current.then(raiseBrightness);
    queue.current = raised;
    return () => {
      deactivateKeepAwake(tag).catch(ignore);
      queue.current = raised.then((restore) => restore());
    };
  }, [on, tag]);
}
