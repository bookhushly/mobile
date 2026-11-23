import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { CarRequestFlowScreen } from '@/features/customer/screens/CarRequestFlowScreen';

// Phase 6: asking for car rental quotes. Signed out works too; sending asks for sign-in.
export default function NewCarRequestRoute() {
  const state = useAuth((s) => s.state);
  return (
    <CarRequestFlowScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      email={state.status === 'signedIn' ? state.email : ''}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
      onSent={(id) => {
        router.replace({ pathname: '/car-rental/[id]', params: { id } });
      }}
    />
  );
}
