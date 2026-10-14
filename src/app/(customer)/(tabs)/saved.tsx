import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { SavedScreen } from '@/features/customer/screens/SavedScreen';

export default function SavedRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : '';
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
