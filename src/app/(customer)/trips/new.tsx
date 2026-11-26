import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { TripFlowScreen } from '@/features/customer/screens/TripFlowScreen';
import { SignedOutTrips } from '@/features/customer/ui/trips/SignedOutTrips';

const close = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/bookings');
};

// Planning a trip needs an account: the trip is saved to it.
export default function NewTripRoute() {
  const state = useAuth((s) => s.state);
  if (state.status !== 'signedIn') return <SignedOutTrips onBack={close} />;
  return (
    <TripFlowScreen
      userId={state.userId}
      onClose={close}
      onCreated={(id) => {
        router.replace({ pathname: '/trips/[id]', params: { id } });
      }}
    />
  );
}
