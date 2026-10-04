import { useAuth } from '@/features/auth/hooks/useAuth';
import { ReceptionistShell } from '@/features/receptionist/screens/ReceptionistShell';

export default function ReceptionistShellRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const identity = state.status === 'signedIn' ? state.email : '';
  return (
    <ReceptionistShell
      identity={identity}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
