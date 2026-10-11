import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// Gate spec §5: the camera is unmounted while the app is in the background.
export function useAppActive(): boolean {
  const [state, setState] = useState<AppStateStatus>(AppState.currentState);
  useEffect(() => {
    const sub = AppState.addEventListener('change', setState);
    return () => {
      sub.remove();
    };
  }, []);
  return state === 'active';
}
