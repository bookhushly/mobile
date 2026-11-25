import { create } from 'zustand';

import { registerAlwaysWipe } from '@/shared/lib/signOutGuard';

export type DraftStore<D, S extends string> = {
  draft: D;
  step: S;
  /** "Ask for quotes" was tapped signed out: send once this person is signed in. */
  sendAfterSignIn: boolean;
  /** Opened from the check step's Edit: Next goes straight back to it. */
  editing: boolean;
  patch: (p: Partial<D>) => void;
  /** Edit one answer from the check step. */
  edit: (step: S) => void;
  next: () => void;
  back: () => void;
  setSendAfterSignIn: (on: boolean) => void;
  /** A fresh request; `keep` carries answers over ("Ask again" after no quotes). */
  start: (keep?: Partial<D>, at?: S) => void;
};

/**
 * A request-for-quote draft (car rental, logistics), step by step. In memory only: a cold start
 * begins a new request. It survives the sign-in sheet because the customer stack stays mounted
 * through sign-in (routing rules), and a sign-out forgets it (addresses and notes are personal).
 */
export function makeDraftStore<D, S extends string>(empty: D, steps: readonly S[], check: S) {
  const first = steps[0] ?? check;
  const at = (s: S) => steps.indexOf(s);
  const store = create<DraftStore<D, S>>((set) => ({
    draft: empty,
    step: first,
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
          ? { step: check, editing: false }
          : { step: steps[Math.min(at(s.step) + 1, steps.length - 1)] ?? s.step },
      );
    },
    back() {
      set((s) =>
        s.editing
          ? { step: check, editing: false }
          : { step: steps[Math.max(at(s.step) - 1, 0)] ?? s.step },
      );
    },
    setSendAfterSignIn(on) {
      set({ sendAfterSignIn: on });
    },
    start(keep, startAt = first) {
      set({ draft: { ...empty, ...keep }, step: startAt, sendAfterSignIn: false, editing: false });
    },
  }));
  registerAlwaysWipe(() => {
    store.getState().start();
    return Promise.resolve();
  });
  return store;
}
