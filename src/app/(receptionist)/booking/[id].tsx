import { useLocalSearchParams } from 'expo-router';

import { DeskPlaceholderScreen } from '@/features/receptionist/screens/DeskPlaceholderScreen';

export default function BookingRoute() {
  // Read only to settle the typed route; Task 12 parses it with a schema.
  useLocalSearchParams<{ id: string }>();
  return <DeskPlaceholderScreen back title="Booking" message="Booking details arrive next." />;
}
