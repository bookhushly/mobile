import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { SecurityRequestScreen } from '@/features/customer/screens/SecurityRequestScreen';

// `/security/{id}`. "Choose and pay" asks for checkout in memory (usePayOnOpen), never by a link.
export default function SecurityRequestRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const state = useAuth((s) => s.state);
  const id = bookingIdParam(params.id) ?? '';
  return (
    <SecurityRequestScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      id={id}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bookings');
      }}
      onSeeQuotes={() => {
        router.push({ pathname: '/security/[id]/quotes', params: { id } });
      }}
      onAskAgain={() => {
        router.replace('/security/new');
      }}
    />
  );
}
