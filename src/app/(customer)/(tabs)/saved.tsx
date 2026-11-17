import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { SavedScreen } from '@/features/customer/screens/SavedScreen';
import { SignedOutTab } from '@/features/customer/ui/SignedOutTab';

export default function SavedRoute() {
  const state = useAuth((s) => s.state);
  if (state.status !== 'signedIn') return <SignedOutRoute />;
  return <SignedInSaved userId={state.userId} />;
}

function SignedOutRoute() {
  return (
    <SignedOutTab
      tab="saved"
      onSignIn={() => {
        router.push('/sign-in');
      }}
      onCreateAccount={() => {
        router.push('/sign-up');
      }}
    />
  );
}

function SignedInSaved({ userId }: { userId: string }) {
  const signOut = useSignOut();
  return (
    <SavedScreen
      userId={userId}
      onOpenListing={(kind, id) => {
        router.push({ pathname: '/listing/[kind]/[id]', params: { kind, id } });
      }}
      onBrowse={() => {
        router.navigate('/explore');
      }}
      onSignInAgain={() => {
        signOut();
      }}
    />
  );
}
