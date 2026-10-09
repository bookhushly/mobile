import { create } from 'zustand';

export type AuthNotice = 'accountDeleted' | null;

type Store = { notice: AuthNotice; set: (n: AuthNotice) => void; clear: () => void };

// One-shot message for the entry screen after the account is deleted.
export const useAuthNotice = create<Store>((set) => ({
  notice: null,
  set: (notice) => {
    set({ notice });
  },
  clear: () => {
    set({ notice: null });
  },
}));
