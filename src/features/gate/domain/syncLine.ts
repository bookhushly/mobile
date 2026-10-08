import type { OverrideAvailability } from '@/features/gate/offline/offlineGate';
import type { OutboxState } from '@/features/gate/offline/outboxStore';
import type { ClockState } from '@/shared/lib/clockGuard';
import { parseIsoMs } from '@/shared/lib/isoTime';

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

export function groupDigits(n: number): string {
  return String(Math.trunc(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
