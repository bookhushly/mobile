import { create } from 'zustand';

import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';

import {
  EMPTY_DRAFT,
  STEPS,
  type CarDraft,
  type Step,
} from '@/features/customer/domain/carRental/carRequest';

type Store = {
  draft: CarDraft;
  step: Step;
  /** "Ask for quotes" was tapped signed out: send once this person is signed in. */
  sendAfterSignIn: boolean;
  /** Opened from the check step's Edit: Next goes straight back to it. */
  editing: boolean;
  patch: (p: Partial<CarDraft>) => void;
  /** Edit one answer from the check step. */
  edit: (step: Step) => void;
  next: () => void;
  back: () => void;
  setSendAfterSignIn: (on: boolean) => void;
  /** A fresh request; `keep` carries answers over ("Ask again" after no quotes). */
  start: (keep?: Partial<CarDraft>, at?: Step) => void;
};

const at = (s: Step) => STEPS.indexOf(s);

// In memory only (like the sign-in prompt): a cold start begins a new request. It survives the
// sign-in sheet because the customer stack stays mounted through sign-in (routing rules).
export const useCarDraft = create<Store>((set) => ({
  draft: EMPTY_DRAFT,
  step: 'where',
  sendAfterSignIn: false,
  editing: false,
  patch(p) {
    set((s) => ({ draft: { ...s.draft, ...p } }));
  },
  edit(step) {
    set({ step, editing: true });
  },
  next() {
    set((s) =>
      s.editing
        ? { step: 'check', editing: false }
        : { step: STEPS[Math.min(at(s.step) + 1, STEPS.length - 1)] ?? s.step },
    );
  },
  back() {
    set((s) =>
      s.editing
        ? { step: 'check', editing: false }
        : { step: STEPS[Math.max(at(s.step) - 1, 0)] ?? s.step },
    );
  },
  setSendAfterSignIn(on) {
    set({ sendAfterSignIn: on });
  },
  start(keep, at = 'where') {
    set({ draft: { ...EMPTY_DRAFT, ...keep }, step: at, sendAfterSignIn: false, editing: false });
  },
}));

// Addresses and notes are the signed-in person's: a sign-out forgets them (shared phones).
registerAlwaysWipe(() => {
  useCarDraft.getState().start();
  return Promise.resolve();
});
