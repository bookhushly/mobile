import {
  CameraView,
  PermissionStatus,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { memo, useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

// loading: the OS has not answered yet (first render); nothing is shown so no prompt flashes.
export type CameraPermission = 'loading' | 'unknown' | 'granted' | 'denied';

export function useCameraAccess() {
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

// Spec §5: the camera is unmounted while the app is in the background.
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

type Props = { torch: boolean; paused: boolean; onCode: (raw: string) => void };

const SCANNER_SETTINGS = { barcodeTypes: ['qr' as const] };
// The camera reports a code on every decoded frame. Forward the same code at most every 500 ms:
// enough for the session's sliding 2 s cooldown to see that it is still in view.
const SAME_FRAME_MS = 500;

// Mounted only while the screen is focused and the app is active (the parent unmounts it).
// memo: the camera subtree must not re-render on summary or overlay changes (perf budget).
export const ScannerCamera = memo(function ScannerCamera({ torch, paused, onCode }: Props) {
  const last = useRef<{ raw: string; at: number } | null>(null);
  const onScanned = (r: BarcodeScanningResult) => {
    const at = performance.now();
    const prev = last.current;
    if (prev !== null && prev.raw === r.data && at - prev.at < SAME_FRAME_MS) return;
    last.current = { raw: r.data, at };
    onCode(r.data);
  };
  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={SCANNER_SETTINGS}
      onBarcodeScanned={paused ? undefined : onScanned}
    />
  );
});
