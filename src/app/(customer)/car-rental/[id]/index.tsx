import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { CarRequestScreen } from '@/features/customer/screens/CarRequestScreen';

// `/car-rental/{id}`. "Choose and pay" asks for checkout in memory (usePayOnOpen), never by a
// link parameter, so nothing outside the app can open a checkout.
export default function CarRequestRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const state = useAuth((s) => s.state);
  const id = bookingIdParam(params.id) ?? '';
  return (
    <CarRequestScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      id={id}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bookings');
      }}
      onSeeQuotes={() => {
        router.push({ pathname: '/car-rental/[id]/quotes', params: { id } });
      }}
      onAskAgain={() => {
        router.replace('/car-rental/new');
      }}
    />
  );
}
