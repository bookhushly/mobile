import type { SessionLite } from '@/features/auth/domain/authState';
import { resolveInitialSession } from '@/features/auth/domain/storedSession';
import { clearStaleRecovery, recoveryPending, useAuth } from '@/features/auth/hooks/useAuth';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { queryClient } from '@/shared/api/queryClient';
import { sessionStore, STORAGE_KEY, supabase } from '@/shared/supabase/client';

type RawSession = { user: { id: string; email?: string | undefined } } | null;

function lite(session: RawSession): SessionLite | null {
  return session ? { userId: session.user.id, email: session.user.email ?? '' } : null;
}

/**
 * Cold-start gate: supabase-js (auth-js 2.117) queues the SIGNED_IN / TOKEN_REFRESHED it emits
 * while recovering the stored session and flushes them *before* INITIAL_SESSION reaches a
 * subscriber. None of them may become "signed in" until the reset marker has been read once:
 * a reset code alone must never leave the user signed in. The read happens once per process;
 * later events (a sign-in, a reset code) reuse the answer, and once a pending reset has been
 * abandoned the gate is settled as "not pending".
 */
function createStartupGate(read: () => Promise<boolean>) {
  let result: Promise<boolean> | null = null;
  return {
    pending: (): Promise<boolean> => (result ??= read()),
    settle: () => {
      result = Promise.resolve(false);
    },
  };
}

export function startSessionListener(): () => void {
  const gate = createStartupGate(recoveryPending);
  let abandoning: Promise<void> | null = null;
  // Killed mid-reset: sign out locally, once, whichever event sees the session first.
  const abandonOnce = (): Promise<void> =>
    (abandoning ??= (async () => {
      try {
        await useAuth.getState().abandonRecovery();
      } catch {
        // Fail safe: whatever went wrong, the app must not resume as signed in.
        useAuth.getState().dispatch({ type: 'SIGNED_OUT' });
      } finally {
        gate.settle();
      }
    })());

  const { data } = supabase.auth.onAuthStateChange((event, session) => {
    const { dispatch } = useAuth.getState();
    const s = lite(session);
    switch (event) {
      case 'INITIAL_SESSION':
        void resolveInitialSession(s, () => sessionStore.getItem(STORAGE_KEY)).then(
          async (resolved) => {
            // An earlier queued event may already have abandoned the reset (and settled the
            // gate): this one-off event must then end signed out too, whatever it carries.
            const pending = abandoning !== null || (await gate.pending());
            if (pending && (resolved !== null || abandoning !== null)) {
              await abandonOnce();
              return;
            }
            if (pending) {
              // Signed out with a leftover marker: nothing to abandon, drop the stale marker.
              await clearStaleRecovery();
              gate.settle();
            }
            dispatch({ type: 'INITIAL_SESSION', session: resolved });
          },
        );
        break;
      case 'SIGNED_IN':
      case 'TOKEN_REFRESHED':
      case 'USER_UPDATED':
        if (s === null) {
          if (event !== 'SIGNED_IN') dispatch({ type: event, session: null });
          break;
        }
        void gate.pending().then(async (pending) => {
          if (pending) {
            await abandonOnce();
            return;
          }
          if (event === 'SIGNED_IN') useAuthNotice.getState().clear();
          dispatch({ type: event, session: s });
        });
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
