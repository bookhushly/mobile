import type { SessionLite } from '@/features/auth/domain/authState';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { supabase } from '@/shared/supabase/client';

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
        dispatch({ type: 'INITIAL_SESSION', session: s });
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
