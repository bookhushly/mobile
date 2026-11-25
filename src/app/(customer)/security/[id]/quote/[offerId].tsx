import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingIdParam } from '@/features/customer/domain/routeParams';
import { QuoteScreen } from '@/features/customer/screens/QuoteScreen';
import { SECURITY_TERMS } from '@/features/customer/ui/car/quoteTerms';

export default function SecurityQuoteRoute() {
  const params = useLocalSearchParams<{ id: string; offerId: string }>();
  const state = useAuth((s) => s.state);
  const id = bookingIdParam(params.id) ?? '';
  const offerId = bookingIdParam(params.offerId) ?? '';
  return (
    <QuoteScreen
      terms={SECURITY_TERMS}
      userId={state.status === 'signedIn' ? state.userId : ''}
      id={id}
      offerId={offerId}
      onBack={() => {
        router.back();
      }}
      onChosen={() => {
        // Back to the request (not a new copy on top), which opens the checkout once.
        router.dismissTo({ pathname: '/security/[id]', params: { id } });
      }}
    />
  );
}
