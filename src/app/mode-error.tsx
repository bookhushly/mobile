import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useModeState } from '@/features/mode/hooks/useModeState';
import { ModeErrorScreen } from '@/features/mode/screens/StatusScreens';

export default function ModeError() {
  const auth = useAuth((s) => s.state);
  // Runs the unsynced-admissions guard before signing out.
  const signOut = useSignOut();
  const { retry } = useModeState(auth.status === 'signedIn' ? auth.userId : null);
  return (
    <ModeErrorScreen
      onRetry={retry}
      onSignOut={() => {
        signOut();
      }}
    />
  );
}
