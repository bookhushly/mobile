import { router, useLocalSearchParams } from 'expo-router';

import { bookingForType } from '@/features/customer/hooks/useTripScreen';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingRefParams } from '@/features/customer/domain/routeParams';
import { PayScreen } from '@/features/customer/screens/PayScreen';

// Spec P22: `/pay/{hotel|apartment|event}/{bookingId}[?free=1][&from=select]`. Anything off-shape
// is "Booking not found", without a query. `from=select` is set only by Select's hand-off (A2a).
export default function PayRoute() {
  const params = useLocalSearchParams<{
    kind: string;
    bookingId: string;
    free?: string;
    from?: string;
  }>();
  const state = useAuth((s) => s.state);
  return (
    <PayScreen
      booking={bookingRefParams(params.kind, params.bookingId)}
      free={params.free === '1'}
      fromSelect={params.from === 'select'}
      userId={state.status === 'signedIn' ? state.userId : ''}
      email={state.status === 'signedIn' ? state.email : ''}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bookings');
      }}
      onBookings={() => {
        router.dismissTo('/bookings');
      }}
      onStartAgain={(to) => {
        if (to === null) router.dismissTo('/explore');
        else if (to.kind === 'hotel' && to.roomTypeId === null) {
          // Select needs the room type: the listing lets the customer choose one.
          router.replace({
            pathname: '/listing/[kind]/[id]',
            params: { kind: to.kind, id: to.listingId },
          });
        } else {
          router.replace({
            pathname: '/checkout/[kind]/[listingId]',
            params:
              to.roomTypeId === null
                ? { kind: to.kind, listingId: to.listingId }
                : { kind: to.kind, listingId: to.listingId, roomType: to.roomTypeId },
          });
        }
      }}
      onViewTickets={(bookingId) => {
        router.replace({ pathname: '/tickets/[bookingId]', params: { bookingId } });
      }}
      onViewBooking={(kind, id) => {
        router.replace({ pathname: '/my-booking/[kind]/[id]', params: { kind, id } });
      }}
      onDone={() => {
        router.dismissTo('/explore');
      }}
      onCrossSell={(item) => {
        const to = bookingForType(item.type);
        if (to.to === 'results')
          router.replace({ pathname: '/results', params: { category: to.category } });
        else router.replace(`/${to.to}/new`);
      }}
      onTrip={(tripId) => {
        if (tripId === null) router.replace('/trips/new');
        else router.replace({ pathname: '/trips/[id]', params: { id: tripId } });
      }}
    />
  );
}
