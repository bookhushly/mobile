import { ScanLine } from 'lucide-react-native';

import { useVendorSession } from '@/features/vendor/hooks/VendorContext';

import { HandOffScreen } from '@/features/vendor/screens/HandOffScreen';

export function VendorScan() {
  const { switchToGate } = useVendorSession();
  return (
    <HandOffScreen
      icon={ScanLine}
      title="Scan tickets"
      message={
        switchToGate === null
          ? 'Scanning opens once you have an event coming up. Your gate staff can scan from their own Bookhushly app.'
          : 'Scanning opens the gate screens: they work offline at the door and check each ticket once.'
      }
      action={switchToGate === null ? null : { label: 'Open the scanner', onPress: switchToGate }}
      testID="vendor-open-scanner"
    />
  );
}
