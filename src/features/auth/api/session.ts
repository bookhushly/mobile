import type { SessionLite } from '@/features/auth/domain/authState';
import { resolveInitialSession } from '@/features/auth/domain/storedSession';
import { recoveryPending, useAuth } from '@/features/auth/hooks/useAuth';
import { queryClient } from '@/shared/api/queryClient';
import { sessionStore, STORAGE_KEY, supabase } from '@/shared/supabase/client';

type RawSession = { user: { id: string; email?: string | undefined } } | null;

function lite(session: RawSession): SessionLite | null {
  return session ? { userId: session.user.id, email: session.user.email ?? '' } : null;
}

export function startSessionListener(): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const { dispatch } = useAuth.getState();
    const s = lite(session);
    switch (event) {
      case 'INITIAL_SESSION':
        void resolveInitialSession(s, () => sessionStore.getItem(STORAGE_KEY)).then(
          async (resolved) => {
            if (resolved !== null && (await recoveryPending())) {
              // Killed mid-reset: a reset code alone must never leave the user signed in.
              try {
                await useAuth.getState().abandonRecovery();
              } catch {
                // Fail safe: whatever went wrong, the app must not resume as signed in.
                dispatch({ type: 'SIGNED_OUT' });
              }
              return;
            }
            dispatch({ type: 'INITIAL_SESSION', session: resolved });
          },
        );
        break;
      case 'SIGNED_IN':
        if (s) dispatch({ type: 'SIGNED_IN', session: s });
        break;
      case 'TOKEN_REFRESHED':
        dispatch({ type: 'TOKEN_REFRESHED', session: s });
        break;
      case 'USER_UPDATED':
        dispatch({ type: 'USER_UPDATED', session: s });
        break;
      case 'SIGNED_OUT':
        queryClient.clear();
        dispatch({ type: 'SIGNED_OUT' });
        break;
      case 'PASSWORD_RECOVERY':
      case 'MFA_CHALLENGE_VERIFIED':
        break;
    }
  });
  return () => {
    data.subscription.unsubscribe();
  };
}
