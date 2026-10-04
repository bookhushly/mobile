import { useAuth } from '@/features/auth/hooks/useAuth';
import { GateShell } from '@/features/gate/screens/GateShell';

export default function GateShellRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const identity = state.status === 'signedIn' ? state.email : '';
  return (
    <GateShell
      identity={identity}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
