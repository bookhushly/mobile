import { create } from 'zustand';

import { reduceAuth, type AuthState, type SessionEvent } from '@/features/auth/domain/authState';
import { createRecovery } from '@/features/auth/domain/recovery';
import { mapSignInError, type SignInError } from '@/features/auth/domain/signInErrors';
import { performSignOut } from '@/features/auth/domain/signOut';
import { planSignOut, type SignOutOptions } from '@/features/auth/domain/signOutPlan';
import { mapVerifyError, type VerifyError } from '@/features/auth/domain/verifyErrors';
import { useAuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { queryClient } from '@/shared/api/queryClient';
import { checkSignOut, wipeOnSignOut, type SignOutCheck } from '@/shared/lib/signOutGuard';
import { secureKv } from '@/shared/platform/secureStore';
import { sessionStore, STORAGE_KEY, supabase } from '@/shared/supabase/client';

const recoveryMarker = createRecovery(secureKv);

/** Read by the session listener at cold start: a leftover marker means "sign out locally". */
export const recoveryPending = (): Promise<boolean> => recoveryMarker.pending();

type Store = {
  state: AuthState;
  /** A password reset is in progress: signed in by a code, but no new password saved yet. */
  recovery: boolean;
  dispatch: (e: SessionEvent) => void;
  signIn: (email: string, password: string) => Promise<SignInError | null>;
  signOut: (opts?: SignOutOptions) => Promise<{ blocked: SignOutCheck | null }>;
  verifyCode: (
    email: string,
    code: string,
    type: 'signup' | 'recovery',
  ) => Promise<VerifyError | null>;
  finishRecovery: () => Promise<void>;
  abandonRecovery: () => Promise<void>;
  /** `closed`: the account is banned, i.e. a deletion already went through. */
  checkPassword: (password: string) => Promise<'ok' | 'wrong' | 'transient' | 'closed'>;
  /** `userId` is captured before the delete starts: the session may already be gone by now. */
  signOutAfterDeletion: (userId: string) => Promise<void>;
};

// Clears the reset-in-progress state. Best effort and never rejects: the store flag is always
// cleared, and a marker that could not be deleted only causes a local sign-out at the next start.
async function clearRecovery(set: (p: { recovery: boolean }) => void): Promise<void> {
  try {
    await recoveryMarker.finish();
  } catch {
    // see above
  } finally {
    set({ recovery: false });
  }
}

// Drops this device's session only (no server-side revocation of other sessions).
async function signOutLocally(): Promise<void> {
  await performSignOut({
    remote: () => supabase.auth.signOut({ scope: 'local' }),
    removeLocal: () => sessionStore.removeItem(STORAGE_KEY),
    onSignedOut: () => {
      queryClient.clear();
      useAuth.getState().dispatch({ type: 'SIGNED_OUT' });
    },
  });
}

export const useAuth = create<Store>((set, get) => ({
  state: { status: 'loading' },
  recovery: false,
  dispatch: (e) => {
    set({ state: reduceAuth(get().state, e) });
  },
  async signIn(email, password) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? mapSignInError(error) : null;
  },
  async signOut(opts = {}) {
    const s = get().state;
    const userId = s.status === 'signedIn' ? s.userId : null;
    if (userId !== null && opts.keepOfflineData !== true) {
      let check: SignOutCheck | null = null;
      try {
        check = await checkSignOut(userId);
      } catch {
        check = null;
      }
      const plan = planSignOut(check, opts);
      if (typeof plan === 'object') return { blocked: plan.blocked };
      if (plan === 'wipe') await wipeOnSignOut(userId);
    }
    await performSignOut({
      remote: () => supabase.auth.signOut(),
      removeLocal: () => sessionStore.removeItem(STORAGE_KEY),
      onSignedOut: () => {
        queryClient.clear();
        get().dispatch({ type: 'SIGNED_OUT' });
      },
    });
    return { blocked: null };
  },
  async verifyCode(email, code, type) {
    if (type !== 'recovery') {
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
      return error ? mapVerifyError(error) : null;
    }
    // Before verifyOtp: its SIGNED_IN event must already see the reset in progress. Any failure
    // (thrown or returned) must undo that, or the app would stay pinned to the auth screens.
    set({ recovery: true });
    try {
      await recoveryMarker.begin();
      const { error } = await supabase.auth.verifyOtp({ email, token: code, type });
      if (!error) return null;
      await clearRecovery(set);
      return mapVerifyError(error);
    } catch {
      await clearRecovery(set);
      return 'transient';
    }
  },
  async finishRecovery() {
    await clearRecovery(set);
  },
  async abandonRecovery() {
    // Leaving the new-password screen (or a cold start mid-reset): the code alone must never
    // leave the user signed in. Local only: the user's other sessions stay; offline gate data
    // is kept (FR-3.11). Never rejects: whatever fails, the app ends up signed out.
    await clearRecovery(set);
    try {
      await signOutLocally();
    } catch {
      queryClient.clear();
      get().dispatch({ type: 'SIGNED_OUT' });
    }
  },
  async checkPassword(password) {
    const s = get().state;
    if (s.status !== 'signedIn') return 'wrong';
    const { error } = await supabase.auth.signInWithPassword({ email: s.email, password });
    if (!error) return 'ok';
    const kind = mapSignInError(error);
    if (kind === 'invalidCredentials') return 'wrong';
    if (kind === 'accountClosed') return 'closed';
    return 'transient';
  },
  async signOutAfterDeletion(userId) {
    // Wipe by the captured id, whatever the store says: a banned refresh can have emitted
    // SIGNED_OUT already, and the encrypted roster/outbox must not outlive a deleted account.
    try {
      await wipeOnSignOut(userId);
    } catch {
      // The account is gone server-side; local data is wiped best effort and sign-out still runs.
    }
    // Never rejects: the account no longer exists, so whatever fails the app ends up signed out.
    try {
      await signOutLocally();
    } catch {
      queryClient.clear();
      get().dispatch({ type: 'SIGNED_OUT' });
    }
    useAuthNotice.getState().set('accountDeleted');
  },
}));
