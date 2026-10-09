import { router } from 'expo-router';

import { useAuth } from '@/features/auth/hooks/useAuth';
import { useSignOut } from '@/features/auth/hooks/useSignOut';
import { useTourSeen } from '@/features/customer/hooks/useTourSeen';
import { CustomerShell } from '@/features/customer/screens/CustomerShell';
import { TourScreen } from '@/features/customer/screens/TourScreen';
import { useModeSwitcher } from '@/features/mode/hooks/useModeSwitcher';
import { ModeSwitcher } from '@/features/mode/screens/ModeSwitcher';
import { CUSTOMER_TOUR_ENABLED } from '@/shared/config/features';

export default function CustomerHomeRoute() {
  const state = useAuth((s) => s.state);
  const signOut = useSignOut();
  const userId = state.status === 'signedIn' ? state.userId : null;
  const { modes, choose } = useModeSwitcher(userId);
  const { seen, markSeen } = useTourSeen(userId);
  // Only a resolved "not seen" shows the tour: null (still reading) falls through to the shell.
  if (CUSTOMER_TOUR_ENABLED && seen === false) return <TourScreen onDone={markSeen} />;
  return (
    <CustomerShell
      identity={state.status === 'signedIn' ? state.email : ''}
      onSignOut={() => {
        signOut();
      }}
      onDeleteAccount={() => {
        router.push('/delete-account');
      }}
    >
      <ModeSwitcher modes={modes} current="customer" onChoose={choose} />
    </CustomerShell>
  );
}
