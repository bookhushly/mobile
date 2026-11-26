import { BedDouble } from 'lucide-react-native';

import { useVendorSession } from '@/features/vendor/hooks/VendorContext';

import { HandOffScreen } from '@/features/vendor/screens/HandOffScreen';

export function VendorRooms() {
  const { switchToDesk } = useVendorSession();
  return (
    <HandOffScreen
      icon={BedDouble}
      title="Rooms"
      message={
        switchToDesk === null
          ? 'Room status and check-in are on the front desk. Your front-desk staff use it from their Bookhushly app.'
          : 'Room status and check-in are on the front desk.'
      }
      action={
        switchToDesk === null ? null : { label: 'Open the front desk', onPress: switchToDesk }
      }
    />
  );
}
