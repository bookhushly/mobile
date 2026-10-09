import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { CustomerShell } from '@/features/customer/screens/CustomerShell';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

export default function CustomerHomeRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const { modes, choose } = useModeSwitcher(state.status === 'signedIn' ? state.userId : null);
  return (
    <CustomerShell
      identity={state.status === 'signedIn' ? state.email : ''}
      onSignOut={() => {
        signOut();
      }}
      onDeleteAccount={() => {
        router.push('/delete-account');
      }}
    >
      <ModeSwitcher modes={modes} current="customer" onChoose={choose} />
    </CustomerShell>
  );
}
