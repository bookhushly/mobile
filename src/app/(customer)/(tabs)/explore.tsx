import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { ExploreScreen } from '@/features/customer/screens/ExploreScreen';

export default function ExploreRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : '';
  return (
    <ExploreScreen
      userId={userId}
      onOpenSearch={() => {
        router.push('/search');
      }}
      onOpenResults={(t) => {
        router.push({ pathname: '/results', params: t });
      }}
      onOpenListing={(kind, id) => {
        router.push({ pathname: '/listing/[kind]/[id]', params: { kind, id } });
      }}
      onShowTickets={(bookingId) => {
        router.push({ pathname: '/tickets/[bookingId]', params: { bookingId } });
      }}
      onShowCheckInCode={(bookingId) => {
        router.push({ pathname: '/check-in-code/[bookingId]', params: { bookingId } });
      }}
      onOpenBookings={() => {
        router.navigate('/bookings');
      }}
      onOpenCarRental={() => {
        router.push('/car-rental/new');
      }}
      onOpenLogistics={() => {
        router.push('/logistics/new');
      }}
      onOpenSecurity={() => {
        router.push('/security/new');
      }}
      onSignInAgain={() => {
        signOut();
      }}
    />
  );
}
