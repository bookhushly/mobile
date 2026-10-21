import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { checkoutParams } from '@/features/customer/domain/routeParams';
import { ListingNotFound } from '@/features/customer/screens/ListingNotFound';
import { SelectScreen } from '@/features/customer/screens/SelectScreen';

const back = () => {
  if (router.canGoBack()) router.back();
  else router.replace('/explore');
};

// Spec P22: `/checkout/{hotel|apartment|event}/{listingId}?roomType=&rate=`. Anything off-shape is
// "isn't available right now", without a query.
export default function CheckoutRoute() {
  const params = useLocalSearchParams<{
    kind: string;
    listingId: string;
    roomType?: string;
    rate?: string;
  }>();
  const state = useAuth((s) => s.state);
  const ref = checkoutParams(params);
  if (ref === null) return <ListingNotFound onBack={back} />;
  return (
    <SelectScreen
      key={`${ref.kind}:${ref.listingId}:${ref.roomTypeId ?? ''}`}
      kind={ref.kind}
      listingId={ref.listingId}
      roomTypeId={ref.roomTypeId}
      rateId={ref.rateId}
      userId={state.status === 'signedIn' ? state.userId : ''}
      email={state.status === 'signedIn' ? state.email : ''}
      onBack={back}
      onCreated={(bookingId, free) => {
        // Select is left behind: Back from Pay never re-creates the booking.
        router.replace({
          pathname: '/pay/[kind]/[bookingId]',
          params: free ? { kind: ref.kind, bookingId, free: '1' } : { kind: ref.kind, bookingId },
        });
      }}
    />
  );
}
