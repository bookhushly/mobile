import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { NotificationsScreen } from '@/features/customer/screens/NotificationsScreen';

export default function NotificationsRoute() {
  const state = useAuth((s) => s.state);
  const userId = state.status === 'signedIn' ? state.userId : '';
  return (
    <NotificationsScreen
      userId={userId}
      onBack={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/bookings');
      }}
      onOpenBooking={(kind, id) => {
        router.push({ pathname: '/my-booking/[kind]/[id]', params: { kind, id } });
      }}
      onOpenTab={(tab) => {
        router.navigate(tab === 'account' ? '/account' : '/bookings');
      }}
    />
  );
}
