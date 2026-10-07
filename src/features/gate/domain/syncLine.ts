import type { ClockState } from '@/shared/lib/clockGuard';

export type SyncStatus = {
  mode: 'online' | 'offline';
  list: { count: number; syncedAt: number } | null;
  download: { done: number; total: number } | null;
  pending: number;
  syncing: boolean;
  attention: number;
  blocked: boolean;
  clock: ClockState;
  localCounts: { admitted: number; total: number } | null;
};

export const EMPTY_SYNC: SyncStatus = {
  mode: 'online',
  list: null,
  download: null,
  pending: 0,
  syncing: false,
  attention: 0,
  blocked: false,
  clock: { suspect: false, checkedAgoMs: null },
  localCounts: null,
};
