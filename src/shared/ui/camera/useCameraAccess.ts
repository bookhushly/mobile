import { PermissionStatus, useCameraPermissions } from 'expo-camera';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

// loading: the OS has not answered yet (first render); nothing is shown so no prompt flashes.
export type CameraPermission = 'loading' | 'unknown' | 'granted' | 'denied';

export function useCameraAccess(): {
  permission: CameraPermission;
  canAsk: boolean;
  request: () => void;
} {
  const [perm, request, get] = useCameraPermissions();
  // Granting in system Settings does not restart the app: re-read on return to foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void get();
    });
    return () => {
      sub.remove();
    };
  }, [get]);
  const ask = useCallback(() => {
    void request();
  }, [request]);
  const permission: CameraPermission =
    perm === null
      ? 'loading'
      : !perm.granted && perm.status === PermissionStatus.UNDETERMINED
        ? 'unknown'
        : perm.granted
          ? 'granted'
          : 'denied';
  return {
    permission,
    canAsk: perm?.canAskAgain ?? true,
    request: ask,
  };
}
