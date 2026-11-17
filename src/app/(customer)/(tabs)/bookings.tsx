import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { BookingsScreen } from '@/features/customer/screens/BookingsScreen';
import { SignedOutTab } from '@/features/customer/ui/SignedOutTab';

export default function BookingsRoute() {
  const state = useAuth((s) => s.state);
  if (state.status !== 'signedIn') return <SignedOutRoute />;
  return <SignedInBookings userId={state.userId} email={state.email} />;
}

function SignedOutRoute() {
  return (
    <SignedOutTab
      tab="bookings"
      onSignIn={() => {
        router.push('/sign-in');
      }}
      onCreateAccount={() => {
        router.push('/sign-up');
      }}
    />
  );
}

function SignedInBookings({ userId, email }: { userId: string; email: string }) {
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
