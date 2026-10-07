import { create } from 'zustand';

import { reduceAuth, type AuthState, type SessionEvent } from '@/features/auth/domain/authState';
import { mapSignInError, type SignInError } from '@/features/auth/domain/signInErrors';
import { performSignOut } from '@/features/auth/domain/signOut';
import { planSignOut, type SignOutOptions } from '@/features/auth/domain/signOutPlan';
import { queryClient } from '@/shared/api/queryClient';
import { checkSignOut, wipeOnSignOut, type SignOutCheck } from '@/shared/lib/signOutGuard';
import { sessionStore, STORAGE_KEY, supabase } from '@/shared/supabase/client';

type Store = {
  state: AuthState;
  dispatch: (e: SessionEvent) => void;
  signIn: (email: string, password: string) => Promise<SignInError | null>;
  signOut: (opts?: SignOutOptions) => Promise<{ blocked: SignOutCheck | null }>;
};

export const useAuth = create<Store>((set, get) => ({
  state: { status: 'loading' },
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
}));
