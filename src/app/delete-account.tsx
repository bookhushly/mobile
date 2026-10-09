import { router } from 'expo-router';
import { useEffect, useState } from 'react';

import { deleteAccount } from '@/features/auth/api/accountApi';
import { afterUncertain } from '@/features/auth/domain/deletionPlan';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { DeleteAccountScreen } from '@/features/auth/screens/DeleteAccountScreen';
import { api } from '@/shared/api/instance';
import { checkSignOut } from '@/shared/lib/signOutGuard';
import { supabase } from '@/shared/supabase/client';
import { DensityProvider } from '@/shared/ui/DensityProvider';

export { ScreenError as ErrorBoundary } from '@/shared/ui/ScreenError';

// Reached from the gate account sheet and the customer shell only; receptionists never link here.
export default function DeleteAccountRoute() {
  const state = useAuth((s) => s.state);
  const checkPassword = useAuth((s) => s.checkPassword);
  const signOutAfterDeletion = useAuth((s) => s.signOutAfterDeletion);
  const userId = state.status === 'signedIn' ? state.userId : null;
  // -1 = unknown (the guard failed): the screen then says "some admissions may not have synced".
  const [unsynced, setUnsynced] = useState(0);

  useEffect(() => {
    if (userId === null) {
      // Opened signed out, or the deletion's sign-out just landed: this modal sits outside every
      // guard, so leave explicitly. The index route redirects to Welcome, which shows the notice.
      router.replace('/');
      return;
    }
    let live = true;
    checkSignOut(userId)
      .then((c) => {
        if (live) setUnsynced(c.unsynced);
      })
      .catch(() => {
        if (live) setUnsynced(-1);
      });
    return () => {
      live = false;
    };
  }, [userId]);

  if (state.status !== 'signedIn') return null;

  return (
    <DensityProvider density="customer">
      <DeleteAccountScreen
        email={state.email}
        unsynced={unsynced}
        onCheckPassword={checkPassword}
        onDelete={() => deleteAccount(api)}
        onConfirmDeletedAfterUncertain={async () =>
          afterUncertain((await supabase.auth.refreshSession()).error) === 'deleted'
        }
        onDeleted={() => {
          // The id is captured here: a banned refresh may already have emitted SIGNED_OUT, and
          // the wipe must still run. Signing out flips auth; the effect above then leaves.
          void signOutAfterDeletion(state.userId);
        }}
        onCancel={() => {
          router.back();
        }}
      />
    </DensityProvider>
  );
}
