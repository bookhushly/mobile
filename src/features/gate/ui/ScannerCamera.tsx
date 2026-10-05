import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useCallback } from 'react';

export type CameraPermission = 'unknown' | 'granted' | 'denied';

export function useCameraAccess() {
  const [perm, request] = useCameraPermissions();
  const ask = useCallback(() => {
    void request();
  }, [request]);
  const permission: CameraPermission =
    perm === null ? 'unknown' : perm.granted ? 'granted' : 'denied';
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
