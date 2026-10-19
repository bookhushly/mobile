import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { BookingsScreen } from '@/features/customer/screens/BookingsScreen';

export default function BookingsRoute() {
  const state = useAuth((s) => s.state);
  const userId = state.status === 'signedIn' ? state.userId : '';
  const email = state.status === 'signedIn' ? state.email : '';
  return (
    <BookingsScreen
      userId={userId}
      email={email}
      onOpenBooking={(kind, id) => {
        router.push({ pathname: '/my-booking/[kind]/[id]', params: { kind, id } });
      }}
      onShowTickets={(bookingId) => {
        router.push({ pathname: '/tickets/[bookingId]', params: { bookingId } });
      }}
      onShowCheckInCode={(bookingId) => {
        router.push({ pathname: '/check-in-code/[bookingId]', params: { bookingId } });
      }}
      onOpenNotifications={() => {
        router.push('/notifications');
      }}
      onBrowse={() => {
        router.navigate('/explore');
      }}
    />
  );
}
