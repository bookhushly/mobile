import type { OutboxState } from '@/features/gate/offline/outboxStore';
import { toCsv } from '@/shared/lib/csv';

import { attentionLine } from './syncLine';

export type ActivityRow = {
  ticketId: string;
  ticketType: string | null;
  ticketIndex: number | null;
  scannedAt: string;
  mode: 'offline' | 'manual_lookup' | 'offline_override';
  state: OutboxState;
  result: Record<string, unknown> | null;
  reason: string | null;
  approvedBy: string | null;
};

/** Rows per Activity page: the controller reads this many; a full page means there may be more. */
export const ACTIVITY_PAGE = 50;

export const ACTIVITY_HEADER: readonly string[] = [
  'ticket_ref',
  'ticket_type',
  'ticket_number',
  'scanned_at',
  'mode',
  'state',
  'server_note',
  'reason',
  'approved_by',
];

// Spec decision 3: no holder names or phone numbers leave the phone in an export; the organiser
// has full details on the web. A short ticket reference is enough to find the row there.
export function activityCsv(items: readonly ActivityRow[]): string {
  return toCsv(
    ACTIVITY_HEADER,
    items.map((i) => [
      i.ticketId.replace(/-/g, '').slice(0, 8),
      i.ticketType,
      i.ticketIndex,
      i.scannedAt,
      i.mode,
      i.state,
      attentionLine({ state: i.state, result: i.result }),
      i.reason,
      i.approvedBy,
    ]),
  );
}
