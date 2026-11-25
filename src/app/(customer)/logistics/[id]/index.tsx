import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { LogisticsRequestScreen } from '@/features/customer/screens/LogisticsRequestScreen';

// `/logistics/{id}`. "Choose and pay" asks for checkout in memory (usePayOnOpen), never by a link.
export default function LogisticsRequestRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const state = useAuth((s) => s.state);
  const id = bookingIdParam(params.id) ?? '';
  return (
    <LogisticsRequestScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      id={id}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bookings');
      }}
      onSeeQuotes={() => {
        router.push({ pathname: '/logistics/[id]/quotes', params: { id } });
      }}
      onAskAgain={() => {
        router.replace('/logistics/new');
      }}
    />
  );
}
