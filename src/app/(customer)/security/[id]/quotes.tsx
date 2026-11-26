import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { QuotesScreen } from '@/features/customer/screens/QuotesScreen';
import { SECURITY_TERMS } from '@/features/customer/ui/car/quoteTerms';

export default function SecurityQuotesRoute() {
  const params = useLocalSearchParams<{ id: string }>();
  const state = useAuth((s) => s.state);
  const id = bookingIdParam(params.id) ?? '';
  return (
    <QuotesScreen
      terms={SECURITY_TERMS}
      userId={state.status === 'signedIn' ? state.userId : ''}
      id={id}
      onBack={() => {
        router.back();
      }}
      onOpenQuote={(offerId) => {
        router.push({ pathname: '/security/[id]/quote/[offerId]', params: { id, offerId } });
      }}
    />
  );
}
