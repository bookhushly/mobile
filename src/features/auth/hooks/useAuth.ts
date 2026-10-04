import { create } from 'zustand';

import { reduceAuth, type AuthState, type SessionEvent } from '@/features/auth/domain/authState';
import { mapSignInError, type SignInError } from '@/features/auth/domain/signInErrors';
import { supabase } from '@/shared/supabase/client';

type Store = {
  state: AuthState;
  dispatch: (e: SessionEvent) => void;
  signIn: (email: string, password: string) => Promise<SignInError | null>;
  signOut: () => Promise<void>;
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
  async signOut() {
    await supabase.auth.signOut();
  },
}));
