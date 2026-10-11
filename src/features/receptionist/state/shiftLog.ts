import { create } from 'zustand';

// R11: this device's log for this session. Memory only (guest names never reach disk); the
// receptionist layout clears it on unmount (sign-out, mode switch).
export type ShiftEntry = {
  at: number;
  kind: 'checkIn' | 'checkOut' | 'reassign' | 'roomStatus';
  text: string;
};

const MAX_ENTRIES = 200;

type Store = { entries: ShiftEntry[]; add(e: ShiftEntry): void; clear(): void };

export const useShiftLog = create<Store>((set) => ({
  entries: [],
  add: (e) => {
    set((s) => ({ entries: [e, ...s.entries].slice(0, MAX_ENTRIES) }));
  },
  clear: () => {
    set({ entries: [] });
  },
}));
