import { create } from 'zustand';

import type { SavedInput } from '@/features/customer/api/savedDb';

export type SignInReason = 'book' | 'save';

type Store = {
  /** What the sheet is asking for; `null` when it's closed. */
  reason: SignInReason | null;
  /** The heart that opened the sheet, saved once this person has signed in as a customer. */
  pendingSave: SavedInput | null;
  ask: (reason: SignInReason, save?: SavedInput) => void;
  /** Not now: closes the sheet and forgets the save. */
  dismiss: () => void;
  /** Create account or Sign in: closes the sheet and keeps the save. */
  proceed: () => void;
  clearPending: () => void;
};

// In memory only: a cold start has forgotten what the person was doing, and so does this.
export const useSignInPrompt = create<Store>((set) => ({
  reason: null,
  pendingSave: null,
  ask(reason, save) {
    set({ reason, pendingSave: save ?? null });
  },
  dismiss() {
    set({ reason: null, pendingSave: null });
  },
  proceed() {
    set({ reason: null });
  },
  clearPending() {
    set({ pendingSave: null });
  },
}));
