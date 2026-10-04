import { useAuth } from '@/features/auth/hooks/useAuth';
import { CustomerShell } from '@/features/customer/screens/CustomerShell';

export default function CustomerShellRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useAuth((s) => s.signOut);
  const identity = state.status === 'signedIn' ? state.email : '';
  return (
    <CustomerShell
      identity={identity}
      onSignOut={() => {
        void signOut();
      }}
    />
  );
}
