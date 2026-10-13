import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingRefParams } from '@/features/customer/domain/routeParams';
import { BookingScreen } from '@/features/customer/screens/BookingScreen';

export default function MyBookingRoute() {
  const params = useLocalSearchParams<{ kind: string; id: string }>();
  const state = useAuth((s) => s.state);
  const userId = state.status === 'signedIn' ? state.userId : '';
  return (
    <BookingScreen
      userId={userId}
      // Anything but a booking kind and a UUID is "isn't on your account", without a query.
      booking={bookingRefParams(params.kind, params.id)}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bookings');
      }}
      onShowTickets={(bookingId) => {
        router.push({ pathname: '/tickets/[bookingId]', params: { bookingId } });
      }}
      onShowCheckInCode={(bookingId) => {
        router.push({ pathname: '/check-in-code/[bookingId]', params: { bookingId } });
      }}
    />
  );
}
