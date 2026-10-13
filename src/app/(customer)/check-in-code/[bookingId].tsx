import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { CheckInCodeScreen } from '@/features/customer/screens/CheckInCodeScreen';

const close = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/bookings');
};

export default function CheckInCodeRoute() {
  const params = useLocalSearchParams<{ bookingId: string }>();
  const state = useAuth((s) => s.state);
  const userId = state.status === 'signedIn' ? state.userId : '';
  return (
    <CheckInCodeScreen
      userId={userId}
      // Anything but a UUID is "isn't on your account", without a query.
      bookingId={bookingIdParam(params.bookingId)}
      onClose={close}
    />
  );
}
