import { create } from 'zustand';

import type { SessionView } from '@/features/gate/domain/scanSession';

const EMPTY: SessionView = { current: null, waiting: 0, pending: 0 };

// Only the overlay and the "checking…" chip subscribe; the camera never re-renders on a result.
export const useScanView = create<{ view: SessionView; set: (v: SessionView) => void }>((set) => ({
  view: EMPTY,
  set: (view) => {
    set({ view });
  },
}));
