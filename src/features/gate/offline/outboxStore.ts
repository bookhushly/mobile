import type { ActivityRow } from '@/features/gate/domain/activityCsv';
import type { RosterTicket } from '@/features/gate/domain/offlineDecide';
import type { Sql } from '@/shared/db/sql';

import { readTicket } from './rosterStore';

export type OutboxState =
  | 'pending'
  | 'sending'
  | 'synced'
  | 'duplicate'
  | 'suspect'
  | 'rejected'
  | 'blocked'
  | 'error';

export type OutboxMode = 'offline' | 'manual_lookup' | 'offline_override';
export type Approval = { approvedBy: string; reason: string | null };

export type OutboxItem = {
  seq: number;
  eventId: string;
  ticketId: string;
  code: string;
  scannedAt: string;
  mode: OutboxMode;
  reason: string | null;
  approvedBy: string | null;
  kid: string | null;
  appVersion: string;
  state: OutboxState;
  attempts: number;
  nextTryAt: number;
  result: Record<string, unknown> | null;
};
export type AttentionItem = OutboxItem & { ticketType: string | null; ticketIndex: number | null };
export type AdmissionInput = {
  eventId: string;
  ticketId: string;
  code: string;
  scannedAt: string;
  kid: string | null;
  appVersion: string;
  mode?: OutboxMode;
  approval?: Approval;
};
export type OverrideInput = {
  eventId: string;
  ticketId: string;
  code: string;
  scannedAt: string;
  appVersion: string;
  approval: Approval;
};
export type ActivityTab = 'toSync' | 'attention' | 'synced';
export type RecordResult =
  | { recorded: true; seq: number }
  | { recorded: false; ticket: RosterTicket | null };

const STATES: readonly OutboxState[] = [
  'pending',
  'sending',
  'synced',
  'duplicate',
  'suspect',
  'rejected',
  'blocked',
  'error',
];
const ATTENTION = "('duplicate', 'suspect', 'rejected', 'blocked', 'error')";
const UNSYNCED = "('pending', 'sending')";
const UNSYNCABLE = "('blocked', 'error')";
const MODES: readonly OutboxMode[] = ['offline', 'manual_lookup', 'offline_override'];
const TAB_STATES: Record<ActivityTab, string> = {
  toSync: UNSYNCED,
  attention: ATTENTION,
  synced: "('synced')",
};

type ItemSqlRow = {
  client_seq: number;
  event_id: string;
  ticket_id: string;
  code: string;
  scanned_at: string;
  mode: string;
  reason: string | null;
  approved_by: string | null;
  kid: string | null;
  app_version: string;
  state: string;
  attempts: number;
  next_try_at: number;
  result: string | null;
};

function parseResult(text: string | null): Record<string, unknown> | null {
  if (text === null) return null;
  try {
    const v: unknown = JSON.parse(text);
    return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const toItem = (r: ItemSqlRow): OutboxItem => ({
  seq: r.client_seq,
  eventId: r.event_id,
  ticketId: r.ticket_id,
  code: r.code,
  scannedAt: r.scanned_at,
  mode: MODES.find((m) => m === r.mode) ?? 'offline',
  reason: r.reason,
  approvedBy: r.approved_by,
  kid: r.kid,
  appVersion: r.app_version,
  state: STATES.find((s) => s === r.state) ?? 'error',
  attempts: r.attempts,
  nextTryAt: r.next_try_at,
  result: parseResult(r.result),
});

async function insertItem(
  t: Sql,
  i: { eventId: string; ticketId: string; code: string; scannedAt: string; kid: string | null; appVersion: string; mode: OutboxMode; approval: Approval | null },
): Promise<number> {
  const r = await t.get<{ seq: number }>(
    `INSERT INTO outbox (event_id, ticket_id, code, scanned_at, mode, kid, app_version, state, reason, approved_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?) RETURNING client_seq AS seq`,
    [i.eventId, i.ticketId, i.code, i.scannedAt, i.mode, i.kid, i.appVersion, i.approval?.reason ?? null, i.approval?.approvedBy ?? null],
  );
  if (r === null) throw new Error('outbox insert returned no row');
  return r.seq;
}

const marks = (n: number) => Array.from({ length: n }, () => '?').join(', ');

export function createOutboxStore(db: Sql, deps: { newDeviceId: () => string }) {
  return {
    // Write-ahead (FR-3.10): the admission and its outbox row commit together, and only then may
    // the caller show "Admitted". The conditional update makes a concurrent second scan lose.
    recordAdmission: (input: AdmissionInput): Promise<RecordResult> =>
      db.tx(async (t): Promise<RecordResult> => {
        const u = await t.run(
          'UPDATE roster_ticket SET checked_in_at = ?, by_me = 1, scanned_by = NULL WHERE event_id = ? AND id = ? AND checked_in_at IS NULL',
          [input.scannedAt, input.eventId, input.ticketId],
        );
        if (u.changes === 0) {
          return { recorded: false, ticket: await readTicket(t, input.eventId, input.ticketId) };
        }
        const seq = await insertItem(t, { ...input, mode: input.mode ?? 'offline', approval: input.approval ?? null });
        return { recorded: true, seq };
      }),

    // FR-3.15: an unlisted ticket. If the list has since caught up, it is an ordinary admission
    // (Review Focus 1); otherwise only the outbox records it, once per ticket.
    recordOverride: (input: OverrideInput): Promise<RecordResult> =>
      db.tx(async (t): Promise<RecordResult> => {
        const listed = await readTicket(t, input.eventId, input.ticketId);
        if (listed !== null) {
          const u = await t.run(
            'UPDATE roster_ticket SET checked_in_at = ?, by_me = 1, scanned_by = NULL WHERE event_id = ? AND id = ? AND checked_in_at IS NULL',
            [input.scannedAt, input.eventId, input.ticketId],
          );
          if (u.changes === 0) return { recorded: false, ticket: await readTicket(t, input.eventId, input.ticketId) };
        } else {
          const dup = await t.get<{ one: number }>(
            'SELECT 1 AS one FROM outbox WHERE event_id = ? AND ticket_id = ? LIMIT 1',
            [input.eventId, input.ticketId],
          );
          if (dup !== null) return { recorded: false, ticket: null };
        }
        const seq = await insertItem(t, { ...input, kid: null, mode: 'offline_override', approval: input.approval });
        return { recorded: true, seq };
      }),

    deviceId: (): Promise<string> =>
      db.tx(async (t) => {
        const r = await t.get<{ v: string }>("SELECT v FROM device WHERE k = 'device_id'");
        if (r !== null) return r.v;
        const id = deps.newDeviceId();
        await t.run("INSERT INTO device (k, v) VALUES ('device_id', ?)", [id]);
        return id;
      }),

    due: async (eventId: string, nowMs: number, limit: number): Promise<OutboxItem[]> =>
      (
        await db.all<ItemSqlRow>(
          "SELECT * FROM outbox WHERE event_id = ? AND state = 'pending' AND next_try_at <= ? ORDER BY client_seq LIMIT ?",
          [eventId, nowMs, limit],
        )
      ).map(toItem),

    markSending: async (seqs: number[]): Promise<void> => {
      if (seqs.length === 0) return;
      await db.run(`UPDATE outbox SET state = 'sending' WHERE state = 'pending' AND client_seq IN (${marks(seqs.length)})`, seqs);
    },

    settle: (
      updates: { seq: number; state: OutboxState; result: Record<string, unknown> | null }[],
    ): Promise<void> =>
      db.tx(async (t) => {
        for (const u of updates) {
          await t.run("UPDATE outbox SET state = ?, result = ? WHERE client_seq = ? AND state = 'sending'", [
            u.state,
            u.result === null ? null : JSON.stringify(u.result),
            u.seq,
          ]);
        }
      }),

    retryLater: async (seqs: number[], nextTryAt: number): Promise<void> => {
      if (seqs.length === 0) return;
      await db.run(
        `UPDATE outbox SET state = 'pending', attempts = attempts + 1, next_try_at = ? WHERE state = 'sending' AND client_seq IN (${marks(seqs.length)})`,
        [nextTryAt, ...seqs],
      );
    },

    // "Sync now" before sign-out: the person is waiting, so don't honour the backoff.
    retryNow: async (eventId: string): Promise<void> => {
      await db.run("UPDATE outbox SET next_try_at = 0 WHERE event_id = ? AND state = 'pending'", [eventId]);
    },

    // A crash mid-send leaves items "sending"; the batch endpoint is idempotent on client_seq.
    resetSending: async (): Promise<void> => {
      await db.run("UPDATE outbox SET state = 'pending' WHERE state = 'sending'");
    },

    blockEvent: async (eventId: string): Promise<void> => {
      await db.run(`UPDATE outbox SET state = 'blocked' WHERE event_id = ? AND state IN ${UNSYNCED}`, [eventId]);
    },

    status: async (eventId: string) => {
      const r = await db.get<{ pending: number | null; attention: number | null; blocked: number | null; next: number | null }>(
        `SELECT sum(state IN ${UNSYNCED}) AS pending, sum(state IN ${ATTENTION}) AS attention,
                sum(state = 'blocked') AS blocked,
                min(CASE WHEN state = 'pending' THEN next_try_at END) AS next
         FROM outbox WHERE event_id = ?`,
        [eventId],
      );
      return {
        pending: r?.pending ?? 0,
        attention: r?.attention ?? 0,
        blocked: (r?.blocked ?? 0) > 0,
        nextTryAt: r?.next ?? null,
      };
    },

    attention: async (eventId: string): Promise<AttentionItem[]> =>
      (
        await db.all<ItemSqlRow & { ticket_type: string | null; ticket_index: number | null }>(
          `SELECT o.*, r.ticket_type, r.ticket_index FROM outbox o
           LEFT JOIN roster_ticket r ON r.event_id = o.event_id AND r.id = o.ticket_id
           WHERE o.event_id = ? AND o.state IN ${ATTENTION} ORDER BY o.client_seq DESC`,
          [eventId],
        )
      ).map((r) => ({ ...toItem(r), ticketType: r.ticket_type, ticketIndex: r.ticket_index })),

    list: async (eventId: string, tab: ActivityTab, beforeSeq: number | null, limit: number): Promise<AttentionItem[]> =>
      (
        await db.all<ItemSqlRow & { ticket_type: string | null; ticket_index: number | null }>(
          `SELECT o.*, r.ticket_type, r.ticket_index FROM outbox o
           LEFT JOIN roster_ticket r ON r.event_id = o.event_id AND r.id = o.ticket_id
           WHERE o.event_id = ? AND o.state IN ${TAB_STATES[tab]} AND o.client_seq < ?
           ORDER BY o.client_seq DESC LIMIT ?`,
          [eventId, beforeSeq ?? Number.MAX_SAFE_INTEGER, limit],
        )
      ).map((r) => ({ ...toItem(r), ticketType: r.ticket_type, ticketIndex: r.ticket_index })),

    exportRows: async (eventId: string): Promise<ActivityRow[]> =>
      (
        await db.all<ItemSqlRow & { ticket_type: string | null; ticket_index: number | null }>(
          `SELECT o.*, r.ticket_type, r.ticket_index FROM outbox o
           LEFT JOIN roster_ticket r ON r.event_id = o.event_id AND r.id = o.ticket_id
           WHERE o.event_id = ? ORDER BY o.client_seq`,
          [eventId],
        )
      ).map((r) => {
        const i = toItem(r);
        return {
          ticketId: i.ticketId, ticketType: r.ticket_type, ticketIndex: r.ticket_index, scannedAt: i.scannedAt,
          mode: i.mode, state: i.state, result: i.result, reason: i.reason, approvedBy: i.approvedBy,
        };
      }),

    totals: async () => {
      const r = await db.get<{ unsynced: number | null; unsyncable: number | null }>(
        `SELECT sum(state IN ${UNSYNCED}) AS unsynced, sum(state IN ${UNSYNCABLE}) AS unsyncable FROM outbox`,
      );
      return { unsynced: r?.unsynced ?? 0, unsyncable: r?.unsyncable ?? 0 };
    },

    eventsWithUnsynced: async (): Promise<string[]> =>
      (await db.all<{ event_id: string }>(`SELECT DISTINCT event_id FROM outbox WHERE state IN ${UNSYNCED}`)).map(
        (r) => r.event_id,
      ),

    hasUnsynced: async (eventId: string): Promise<boolean> =>
      (await db.get<{ one: number }>(
        `SELECT 1 AS one FROM outbox WHERE event_id = ? AND state IN ${UNSYNCED} LIMIT 1`,
        [eventId],
      )) !== null,
  };
}

export type OutboxStore = ReturnType<typeof createOutboxStore>;
