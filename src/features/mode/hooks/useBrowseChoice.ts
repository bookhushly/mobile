import { create } from 'zustand';

import { plainKv } from '@/shared/platform/storage';

const KEY = 'bh.browse';

type Store = {
  /** `null` until the stored choice has been read. */
  browsing: boolean | null;
  load: () => Promise<void>;
  choose: () => void;
  clear: () => void;
};

// Whether a signed-out person chose to browse. No personal data, and in no always-wipe: it has to
// survive a signed-out cold start, or reopening the app would show Welcome again.
export const useBrowseChoice = create<Store>((set, get) => ({
  browsing: null,
  async load() {
    let stored = false;
    try {
      stored = (await plainKv.get(KEY)) === '1';
    } catch {
      stored = false;
    }
    // A choose or clear made during the read is newer than what the read found.
    if (get().browsing === null) set({ browsing: stored });
  },
  choose() {
    set({ browsing: true });
    void plainKv.set(KEY, '1').catch(() => undefined);
  },
  clear() {
    set({ browsing: false });
    void plainKv.delete(KEY).catch(() => undefined);
  },
}));
