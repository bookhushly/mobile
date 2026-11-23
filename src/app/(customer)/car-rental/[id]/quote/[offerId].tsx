import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { CarQuoteScreen } from '@/features/customer/screens/CarQuoteScreen';

export default function CarQuoteRoute() {
  const params = useLocalSearchParams<{ id: string; offerId: string }>();
  const state = useAuth((s) => s.state);
  const id = bookingIdParam(params.id) ?? '';
  const offerId = bookingIdParam(params.offerId) ?? '';
  return (
    <CarQuoteScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      id={id}
      offerId={offerId}
      onBack={() => {
        router.back();
      }}
      onChosen={() => {
        // Back to the request (not a new copy on top), which opens the checkout once.
        router.dismissTo({ pathname: '/car-rental/[id]', params: { id } });
      }}
    />
  );
}
