import { useAuth } from '@/features/auth/hooks/useAuth';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { GateShell } from '@/features/gate/screens/GateShell';

export default function GateShellRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const { modes, choose } = useModeSwitcher(state.status === 'signedIn' ? state.userId : null);
  return (
    <GateShell
      identity={state.status === 'signedIn' ? state.email : ''}
      onSignOut={() => {
        void signOut();
      }}
    >
      <ModeSwitcher modes={modes} current="gate" onChoose={choose} />
    </GateShell>
  );
}
