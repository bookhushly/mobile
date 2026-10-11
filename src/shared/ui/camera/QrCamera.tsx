import { CameraView, type BarcodeScanningResult } from 'expo-camera';
import { memo, useRef } from 'react';

type Props = { torch: boolean; paused: boolean; onCode: (raw: string) => void };

const SCANNER_SETTINGS = { barcodeTypes: ['qr' as const] };
// The camera reports a code on every decoded frame. Forward the same code at most every 500 ms:
// enough for a caller's sliding cooldown to see that it is still in view.
const SAME_FRAME_MS = 500;

// Mounted only while the screen is focused and the app is active (the parent unmounts it).
// memo: the camera subtree must not re-render on summary or overlay changes (perf budget).
export const QrCamera = memo(function QrCamera({ torch, paused, onCode }: Props) {
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
