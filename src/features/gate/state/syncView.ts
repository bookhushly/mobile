import { create } from 'zustand';

import { EMPTY_SYNC, type SyncStatus } from '@/features/gate/domain/syncLine';

// Only the gate status pill (GateStatus), the door counter and Find guest subscribe.
export const useSyncView = create<{
  status: SyncStatus;
  set: (p: Partial<SyncStatus>) => void;
  reset: () => void;
}>((set) => ({
  status: EMPTY_SYNC,
  set: (p) => {
    set((s) => ({ status: { ...s.status, ...p } }));
  },
  reset: () => {
    set({ status: EMPTY_SYNC });
  },
}));
