import { router, useLocalSearchParams } from 'expo-router';

import { VendorBooking } from '@/features/vendor/containers/VendorBooking';

export default function VendorBookingRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <VendorBooking
      id={typeof id === 'string' ? id : ''}
      onBack={() => {
        router.back();
      }}
    />
  );
}
