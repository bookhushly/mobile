import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { CarQuotesScreen } from '@/features/customer/screens/CarQuotesScreen';

export default function CarQuotesRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const state = useAuth((s) => s.state);
  const id = bookingIdParam(params.id) ?? '';
  return (
    <CarQuotesScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      id={id}
      onBack={() => {
        router.back();
      }}
      onOpenQuote={(offerId) => {
        router.push({ pathname: '/car-rental/[id]/quote/[offerId]', params: { id, offerId } });
      }}
    />
  );
}
