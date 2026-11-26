import { router } from 'expo-router';

import { VendorBookings } from '@/features/vendor/containers/VendorBookings';

export default function VendorBookingsTab() {
  return (
    <VendorBookings
      onOpen={(b) => {
        router.push({ pathname: '/vendor/booking/[id]', params: { id: b.id } });
      }}
    />
  );
}
