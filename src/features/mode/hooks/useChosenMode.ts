import { create } from 'zustand';

import { parseMode, type Mode } from '@/features/mode/domain/resolveMode';
import { plainKv } from '@/shared/platform/storage';

type Store = {
  userId: string | null;
  chosen: Mode | null;
  loaded: boolean;
  load: (userId: string) => Promise<void>;
  choose: (userId: string, mode: Mode) => void;
};

const key = (userId: string) => `bh.lastMode.${userId}`;

// One shared store so the root navigator and the switcher see the same choice.
export const useChosenMode = create<Store>((set, get) => ({
  userId: null,
  chosen: null,
  loaded: false,
  async load(userId) {
    const s = get();
    if (s.userId === userId && s.loaded) return;
    set({ userId, chosen: null, loaded: false });
    let stored: Mode | null = null;
    try {
      stored = parseMode(await plainKv.get(key(userId)));
    } catch {
      stored = null;
    }
    if (get().userId === userId) set({ chosen: stored, loaded: true });
  },
  choose(userId, mode) {
    set({ userId, chosen: mode, loaded: true });
    void plainKv.set(key(userId), mode);
  },
}));
