import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { ReceptionistShell } from '@/features/receptionist/screens/ReceptionistShell';

export default function ReceptionistShellRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const { modes, choose } = useModeSwitcher(state.status === 'signedIn' ? state.userId : null);
  return (
    <ReceptionistShell
      identity={state.status === 'signedIn' ? state.email : ''}
      onSignOut={() => {
        signOut();
      }}
    >
      <ModeSwitcher modes={modes} current="receptionist" onChoose={choose} />
    </ReceptionistShell>
  );
}
