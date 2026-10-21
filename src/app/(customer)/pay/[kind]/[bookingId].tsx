import { router, useLocalSearchParams } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { bookingRefParams } from '@/features/customer/domain/routeParams';
import { PayScreen } from '@/features/customer/screens/PayScreen';

// Spec P22: `/pay/{hotel|apartment|event}/{bookingId}[?free=1]`. Anything off-shape is "Booking
// not found", without a query.
export default function PayRoute() {
  const params = useLocalSearchParams<{ kind: string; bookingId: string; free?: string }>();
  const state = useAuth((s) => s.state);
  return (
    <PayScreen
      booking={bookingRefParams(params.kind, params.bookingId)}
      free={params.free === '1'}
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
    />
  );
}
