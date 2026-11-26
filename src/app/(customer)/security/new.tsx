import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { SecurityFlowScreen } from '@/features/customer/screens/SecurityFlowScreen';

// Phase 6: asking for security quotes. Signed out works too; sending asks for sign-in.
export default function NewSecurityRoute() {
  const state = useAuth((s) => s.state);
  return (
    <SecurityFlowScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      email={state.status === 'signedIn' ? state.email : ''}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
      onSent={(id) => {
        router.replace({ pathname: '/security/[id]', params: { id } });
      }}
    />
  );
}
