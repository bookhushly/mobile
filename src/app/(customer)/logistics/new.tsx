import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { LogisticsFlowScreen } from '@/features/customer/screens/LogisticsFlowScreen';

// Phase 6: asking for logistics quotes. Signed out works too; sending asks for sign-in.
export default function NewLogisticsRoute() {
  const state = useAuth((s) => s.state);
  return (
    <LogisticsFlowScreen
      userId={state.status === 'signedIn' ? state.userId : ''}
      email={state.status === 'signedIn' ? state.email : ''}
      onClose={() => {
        if (router.canGoBack()) router.back();
        else router.replace('/explore');
      }}
      onSent={(id) => {
        router.replace({ pathname: '/logistics/[id]', params: { id } });
      }}
    />
  );
}
