import type { ActivityTab } from '@/features/gate/offline/outboxStore';

import { ago } from './ago';
import { groupDigits, type SyncStatus } from './syncLine';

export type PillKind =
  'blocked' | 'attention' | 'clock' | 'syncing' | 'offline' | 'downloading' | 'online';
export type PillTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type StatusPillView = {
  kind: PillKind;
  tone: PillTone;
  text: string;
  /** Activity tab the pill opens. */
  tab: ActivityTab;
  /** Changes only when the state changes (never on "2 min ago" ticks): the live region keys on it. */
  announceKey: string;
};

const STALE_CLOCK_MS = 12 * 3_600_000;

function clockText(s: SyncStatus): string | null {
  if (s.clock.suspect) return 'Phone time changed — connect to re-check';
  const a = s.clock.checkedAgoMs;
  if (a !== null && a > STALE_CLOCK_MS)
    return `Time last checked ${String(Math.floor(a / 3_600_000))} h ago`;
  return null;
}

// FR-3.9: one always-visible line. The most important state wins; Activity holds the rest.
export function statusPill(s: SyncStatus, nowMs: number): StatusPillView {
  const tab: ActivityTab = s.pending > 0 ? 'toSync' : 'synced';
  const view = (kind: PillKind, tone: PillTone, text: string, counted = false): StatusPillView => ({
    kind,
    tone,
    text,
    tab: kind === 'attention' ? 'attention' : tab,
    announceKey: counted
      ? `${kind}:${String(kind === 'attention' ? s.attention : s.pending)}`
      : kind,
  });
  if (s.blocked)
    return view('blocked', 'danger', 'Removed from this event — admissions can’t be sent');
  if (s.attention > 0)
    return view(
      'attention',
      'warning',
      `${String(s.attention)} ${s.attention === 1 ? 'needs' : 'need'} attention`,
      true,
    );
  const clock = clockText(s);
  if (clock !== null) return view('clock', 'warning', clock);
  if (s.syncing && s.pending > 0)
    return view('syncing', 'info', `Syncing ${String(s.pending)}…`, true);
  if (s.mode === 'offline') {
    if (s.list === null) return view('offline', 'neutral', 'Offline · no offline list', true);
    return view(
      'offline',
      'neutral',
      s.pending > 0 ? `Offline · ${String(s.pending)} to sync` : 'Offline · deciding on this phone',
      true,
    );
  }
  if (s.download !== null && s.list === null)
    return view(
      'downloading',
      'info',
      `Downloading list ${groupDigits(s.download.done)} of ${groupDigits(s.download.total)}`,
    );
  if (s.list === null) return view('online', 'success', 'Online · no offline list yet');
  const toSync = s.pending > 0 ? ` · ${String(s.pending)} to sync` : '';
  return view('online', 'success', `Online · list ${ago(s.list.syncedAt, nowMs)}${toSync}`);
}
