import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { AccountScreen } from '@/features/customer/screens/AccountScreen';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

export default function AccountRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : null;
  const { modes, choose } = useModeSwitcher(userId);
  return (
    <AccountScreen
      userId={userId ?? ''}
      email={state.status === 'signedIn' ? state.email : ''}
      modeSwitcher={<ModeSwitcher modes={modes} current="customer" onChoose={choose} />}
      onSignOut={() => {
        signOut();
      }}
      onDeleteAccount={() => {
        router.push('/delete-account');
      }}
    />
  );
}
