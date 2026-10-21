import { router } from 'expo-router';
import { ReceiptText } from 'lucide-react-native';

import { EmptyState, Screen } from '@/shared/ui';

// Placeholder so the Select screen's hand-off is a typed route. Task 11 replaces this file with
// the Pay screen (Review → Checking → Done, spec P22).
export default function PayRoute() {
  return (
    <Screen>
      <EmptyState
        icon={ReceiptText}
        title="Your booking is saved. Open it from Bookings to pay."
        action={{
          label: 'Go to Bookings',
          onPress: () => {
            router.replace('/bookings');
          },
        }}
      />
    </Screen>
  );
}
