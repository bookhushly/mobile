import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { AccountScreen } from '@/features/customer/screens/AccountScreen';
import { SignedOutTab } from '@/features/customer/ui/SignedOutTab';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';

export default function AccountRoute() {
  const state = useAuth((s) => s.state);
  if (state.status !== 'signedIn') return <SignedOutRoute />;
  return <SignedInAccount userId={state.userId} email={state.email} />;
}

function SignedOutRoute() {
  return (
    <SignedOutTab
      tab="account"
      onSignIn={() => {
        router.push('/sign-in');
      }}
      onCreateAccount={() => {
        router.push('/sign-up');
      }}
    />
  );
}

function SignedInAccount({ userId, email }: { userId: string; email: string }) {
  const signOut = useSignOut();
  const { modes, choose } = useModeSwitcher(userId);
  return (
    <AccountScreen
      userId={userId}
      email={email}
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
