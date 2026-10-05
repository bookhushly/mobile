import {
  CameraView,
  PermissionStatus,
  useCameraPermissions,
  type BarcodeScanningResult,
} from 'expo-camera';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

export type CameraPermission = 'unknown' | 'granted' | 'denied';

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
    perm === null || (!perm.granted && perm.status === PermissionStatus.UNDETERMINED)
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

type Props = { torch: boolean; onCode: (raw: string) => void };

// Mounted only while the screen is focused (the parent unmounts it on blur).
export function ScannerCamera({ torch, onCode }: Props) {
  return (
    <CameraView
      style={{ flex: 1 }}
      facing="back"
      enableTorch={torch}
      barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
      onBarcodeScanned={(r: BarcodeScanningResult) => {
        onCode(r.data);
      }}
    />
  );
}
