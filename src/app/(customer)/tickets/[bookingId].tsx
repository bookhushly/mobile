import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { TicketsScreen } from '@/features/customer/screens/TicketsScreen';

const close = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/bookings');
};

export default function TicketsRoute() {
  const params = useLocalSearchParams<{ bookingId: string; index?: string }>();
  const state = useAuth((s) => s.state);
  const userId = state.status === 'signedIn' ? state.userId : '';
  const signOut = useSignOut();
  return (
    <TicketsScreen
      userId={userId}
      // Anything but a UUID is "isn't on your account", without a query.
      bookingId={bookingIdParam(params.bookingId)}
      index={params.index}
      onClose={close}
      // An expired session: signing out lands on the sign-in screen.
      onSignIn={() => {
        signOut();
      }}
    />
  );
}
