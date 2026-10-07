import type { OverrideAvailability } from '@/features/gate/offline/offlineGate';
import type { OutboxState } from '@/features/gate/offline/outboxStore';
import type { ClockState } from '@/shared/lib/clockGuard';
import { parseIsoMs } from '@/shared/lib/isoTime';

import { ago } from './ago';

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
  override: OverrideAvailability;
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
  override: { kind: 'none' },
};

export type SyncLine = {
  text: string;
  warning: string | null;
  tone: 'normal' | 'offline' | 'problem';
};

const STALE_CLOCK_MS = 12 * 3_600_000;

export function groupDigits(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function clockWarning(s: SyncStatus): string | null {
  if (s.clock.suspect) return 'Phone time changed — connect to re-check';
  const a = s.clock.checkedAgoMs;
  if (a !== null && a > STALE_CLOCK_MS)
    return `Time last checked ${String(Math.floor(a / 3_600_000))} h ago`;
  return null;
}

// FR-3.9: the sync state is always visible and never hides unsynced admissions.
export function syncLine(s: SyncStatus, nowMs: number): SyncLine {
  const warning = clockWarning(s);
  const toSync = s.pending > 0 ? ` · ${String(s.pending)} to sync` : '';
  if (s.blocked)
    return {
      text: 'Removed from this event — offline admissions can’t be sent',
      warning,
      tone: 'problem',
    };
  if (s.download !== null && s.list === null) {
    return {
      text: `Downloading offline list ${groupDigits(s.download.done)} of ${groupDigits(s.download.total)}`,
      warning,
      tone: 'normal',
    };
  }
  if (s.mode === 'offline') {
    return s.list === null
      ? { text: 'Offline · no offline list on this phone', warning, tone: 'problem' }
      : { text: `Offline · deciding on this phone${toSync}`, warning, tone: 'offline' };
  }
  if (s.syncing && s.pending > 0)
    return { text: `Syncing ${String(s.pending)}…`, warning, tone: 'normal' };
  if (s.list === null)
    return { text: 'Online · offline list not downloaded yet', warning, tone: 'normal' };
  return {
    text: `Online · offline list ${groupDigits(s.list.count)} · ${ago(s.list.syncedAt, nowMs)}${toSync}`,
    warning,
    tone: 'normal',
  };
}

const REJECTED: Record<string, string> = {
  not_found: 'ticket not found',
  wrong_event: 'ticket is for a different event',
  not_confirmed: 'booking not confirmed',
  static_not_allowed: 'printed QR not accepted for this event',
  bad_timestamp: 'the phone’s time was wrong',
  booking_qr: 'booking code, not a ticket',
  forbidden: 'not assigned to this event',
};

const pad = (n: number) => String(n).padStart(2, '0');
const clockTime = (iso: unknown) => {
  const t = typeof iso === 'string' ? parseIsoMs(iso) : null;
  if (t === null) return '';
  const d = new Date(t);
  return ` at ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function attentionLine(item: {
  state: OutboxState;
  result: Record<string, unknown> | null;
}): string {
  const r = item.result ?? {};
  switch (item.state) {
    case 'duplicate': {
      const by =
        typeof r.scanned_by === 'string' && r.scanned_by !== '' ? r.scanned_by : 'another scanner';
      return `Also admitted by ${by}${clockTime(r.checked_in_at)}`;
    }
    case 'suspect':
      return 'The server says this code was not valid';
    case 'rejected': {
      const code = typeof r.code === 'string' ? r.code : '';
      return `Not accepted — ${REJECTED[code] ?? 'the server refused it'}`;
    }
    case 'blocked':
      return 'Not sent — you were removed from this event';
    case 'error':
      return 'Not sent — the server refused the request';
    case 'pending':
    case 'sending':
    case 'synced':
      return '';
  }
}
