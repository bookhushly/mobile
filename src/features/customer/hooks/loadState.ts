import { useState } from 'react';

export type Loaded = {
  data: unknown;
  isError: boolean;
  fetchStatus: 'fetching' | 'paused' | 'idle';
  dataUpdatedAt: number;
  errorUpdatedAt: number;
};

/**
 * Nothing to show from the network: the load failed, or it is paused because the device is
 * offline (TanStack's default networkMode never even starts the fetch then) — C9/C17.
 */
export function loadFailed(q: Loaded): boolean {
  return q.data === undefined && (q.isError || q.fetchStatus === 'paused');
}

/**
 * `loadFailed`, latched until real data arrives: when the device comes back online the paused
 * fetch resumes (no longer failed, still no data), and the saved list must not flip back to a
 * spinner, or flicker if that fetch fails too (N1).
 */
export function useLoadFailed(q: Loaded, userId: string): boolean {
  const failedNow = loadFailed(q);
  const [latchedFor, setLatchedFor] = useState<string | null>(null);
  if (failedNow && latchedFor !== userId) setLatchedFor(userId);
  if (q.data !== undefined && latchedFor !== null) setLatchedFor(null);
  return q.data === undefined && (failedNow || latchedFor === userId);
}

// Changes on every fetch (fetchStatus flips), even one that settles within the same millisecond.
export function fetchStamp(q: Loaded): string {
  return `${String(q.dataUpdatedAt)}|${String(q.errorUpdatedAt)}|${q.fetchStatus}`;
}
