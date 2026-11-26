import { router } from 'expo-router';

import { VendorBookings } from '@/features/vendor/screens/VendorListingContainers';

export default function VendorBookingsTab() {
  return (
    <VendorBookings
      onOpen={(b) => {
        router.push({ pathname: '/vendor/booking/[id]', params: { id: b.id } });
      }}
    />
  );
}
