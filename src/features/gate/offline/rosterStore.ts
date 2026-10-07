import type { TicketKey } from '@/features/gate/domain/bh2';
import type { RosterTicket } from '@/features/gate/domain/offlineDecide';
import type { Sql, SqlValue } from '@/shared/db/sql';
import { parseIsoMs } from '@/shared/lib/isoTime';

export type RosterRow = RosterTicket & {
  holderName: string | null;
  phoneMasked: string | null;
  seat: string | null;
};
export type RosterEventInfo = {
  title: string | null;
  eventDate: string | null;
  requireDynamic: boolean;
  total: number;
};
export type SyncKind = 'full' | 'delta';
export type RosterMeta = {
  eventId: string;
  title: string | null;
  eventDate: string | null;
  requireDynamic: boolean;
  total: number;
  keys: TicketKey[];
  ready: boolean;
  syncKind: SyncKind | null;
  cursor: string | null;
  pendingMark: string | null;
  sinceMark: string | null;
  syncedAt: number | null;
  fullAt: number | null;
  endsAt: number | null;
};

const COLS = [
  'event_id',
  'id',
  'ticket_type',
  'ticket_index',
  'booking_id',
  'booking_status',
  'checked_in_at',
  'scanned_by',
  'by_me',
  'holder_name',
  'phone_masked',
  'seat',
] as const;
const COL_LIST = COLS.join(', ');
const ROW_PLACEHOLDERS = `(${COLS.map(() => '?').join(', ')})`;
// 50 rows × 12 columns = 600 parameters per statement: few bridge calls, under SQLite's limit.
const CHUNK = 50;

// A delta never erases an admission: a later server null keeps what this phone already knows.
const DELTA_MERGE = `ON CONFLICT (event_id, id) DO UPDATE SET
  ticket_type = excluded.ticket_type,
  ticket_index = excluded.ticket_index,
  booking_id = excluded.booking_id,
  booking_status = excluded.booking_status,
  checked_in_at = COALESCE(excluded.checked_in_at, roster_ticket.checked_in_at),
  scanned_by = CASE WHEN excluded.checked_in_at IS NULL THEN roster_ticket.scanned_by ELSE excluded.scanned_by END,
  by_me = CASE WHEN excluded.checked_in_at IS NULL THEN roster_ticket.by_me ELSE excluded.by_me END,
  holder_name = excluded.holder_name,
  phone_masked = excluded.phone_masked,
  seat = excluded.seat`;

// After a full swap, admissions this phone made (and may not have synced before the snapshot)
// are put back so a second presentation is still "already used".
const REAPPLY_OUTBOX = `UPDATE roster_ticket
  SET checked_in_at = o.scanned_at, by_me = 1, scanned_by = NULL
  FROM (
    SELECT ticket_id, MIN(scanned_at) AS scanned_at FROM outbox
    WHERE event_id = ? AND state IN ('pending', 'sending', 'synced')
    GROUP BY ticket_id
  ) AS o
  WHERE roster_ticket.event_id = ? AND roster_ticket.id = o.ticket_id
    AND roster_ticket.checked_in_at IS NULL`;

type TicketSqlRow = {
  id: string;
  ticket_type: string | null;
  ticket_index: number | null;
  booking_id: string;
  booking_status: string;
  checked_in_at: string | null;
  scanned_by: string | null;
  by_me: number | null;
};
type MetaSqlRow = {
  event_id: string;
  title: string | null;
  event_date: string | null;
  require_dynamic: number;
  total: number;
  keys: string;
  ready: number;
  sync_kind: string | null;
  cursor: string | null;
  pending_mark: string | null;
  since_mark: string | null;
  synced_at: number | null;
  full_at: number | null;
  ends_at: number | null;
};

const toTicket = (r: TicketSqlRow): RosterTicket => ({
  id: r.id,
  ticketType: r.ticket_type,
  ticketIndex: r.ticket_index,
  bookingId: r.booking_id,
  bookingStatus: r.booking_status,
  checkedInAt: r.checked_in_at,
  scannedBy: r.scanned_by,
  byMe: r.by_me === null ? null : r.by_me === 1,
});

function parseKeys(text: string): TicketKey[] {
  try {
    const v: unknown = JSON.parse(text);
    if (!Array.isArray(v)) return [];
    return v.flatMap((k: unknown) =>
      typeof k === 'object' &&
      k !== null &&
      'kid' in k &&
      typeof k.kid === 'string' &&
      'publicKey' in k &&
      typeof k.publicKey === 'string'
        ? [{ kid: k.kid, publicKey: k.publicKey }]
        : [],
    );
  } catch {
    return [];
  }
}

const toMeta = (r: MetaSqlRow): RosterMeta => ({
  eventId: r.event_id,
  title: r.title,
  eventDate: r.event_date,
  requireDynamic: r.require_dynamic === 1,
  total: r.total,
  keys: parseKeys(r.keys),
  ready: r.ready === 1,
  syncKind: r.sync_kind === 'full' || r.sync_kind === 'delta' ? r.sync_kind : null,
  cursor: r.cursor,
  pendingMark: r.pending_mark,
  sinceMark: r.since_mark,
  syncedAt: r.synced_at,
  fullAt: r.full_at,
  endsAt: r.ends_at,
});

const values = (eventId: string, r: RosterRow): SqlValue[] => [
  eventId,
  r.id,
  r.ticketType,
  r.ticketIndex,
  r.bookingId,
  r.bookingStatus,
  r.checkedInAt,
  r.scannedBy,
  r.byMe === null ? null : r.byMe ? 1 : 0,
  r.holderName,
  r.phoneMasked,
  r.seat,
];

async function insertRows(t: Sql, head: string, tail: string, eventId: string, rows: RosterRow[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const part = rows.slice(i, i + CHUNK);
    await t.run(
      `${head} (${COL_LIST}) VALUES ${part.map(() => ROW_PLACEHOLDERS).join(', ')} ${tail}`,
      part.flatMap((r) => values(eventId, r)),
    );
  }
}

const TICKET_SELECT =
  'SELECT id, ticket_type, ticket_index, booking_id, booking_status, checked_in_at, scanned_by, by_me FROM roster_ticket';

export async function readTicket(db: Sql, eventId: string, id: string): Promise<RosterTicket | null> {
  const r = await db.get<TicketSqlRow>(`${TICKET_SELECT} WHERE event_id = ? AND id = ?`, [eventId, id]);
  return r === null ? null : toTicket(r);
}

export function createRosterStore(db: Sql) {
  return {
    meta: async (eventId: string): Promise<RosterMeta | null> => {
      const r = await db.get<MetaSqlRow>('SELECT * FROM roster_meta WHERE event_id = ?', [eventId]);
      return r === null ? null : toMeta(r);
    },

    beginSync: (
      eventId: string,
      kind: SyncKind,
      mark: string,
      info: RosterEventInfo,
      keys: TicketKey[] | null,
    ): Promise<void> =>
      db.tx(async (t) => {
        await t.run('INSERT INTO roster_meta (event_id) VALUES (?) ON CONFLICT (event_id) DO NOTHING', [
          eventId,
        ]);
        await t.run(
          `UPDATE roster_meta SET sync_kind = ?, cursor = NULL, pending_mark = ?, title = ?,
             event_date = ?, require_dynamic = ?, total = ? WHERE event_id = ?`,
          [kind, mark, info.title, info.eventDate, info.requireDynamic ? 1 : 0, info.total, eventId],
        );
        if (keys !== null) {
          await t.run('UPDATE roster_meta SET keys = ? WHERE event_id = ?', [JSON.stringify(keys), eventId]);
        }
        if (kind === 'full') await t.run('DELETE FROM roster_staging WHERE event_id = ?', [eventId]);
      }),

    // The page and its cursor commit together, so a resumed sync never skips or repeats a page.
    writePage: (eventId: string, kind: SyncKind, rows: RosterRow[], nextCursor: string | null) =>
      db.tx(async (t) => {
        if (kind === 'full') await insertRows(t, 'INSERT OR REPLACE INTO roster_staging', '', eventId, rows);
        else await insertRows(t, 'INSERT INTO roster_ticket', DELTA_MERGE, eventId, rows);
        await t.run('UPDATE roster_meta SET cursor = ? WHERE event_id = ?', [nextCursor, eventId]);
      }),

    finishSync: (eventId: string, kind: SyncKind): Promise<void> =>
      db.tx(async (t) => {
        const m = await t.get<{ pending_mark: string | null }>(
          'SELECT pending_mark FROM roster_meta WHERE event_id = ?',
          [eventId],
        );
        const at = parseIsoMs(m?.pending_mark);
        if (kind === 'full') {
          await t.run('DELETE FROM roster_ticket WHERE event_id = ?', [eventId]);
          await t.run(
            `INSERT INTO roster_ticket (${COL_LIST}) SELECT ${COL_LIST} FROM roster_staging WHERE event_id = ?`,
            [eventId],
          );
          await t.run('DELETE FROM roster_staging WHERE event_id = ?', [eventId]);
          await t.run(REAPPLY_OUTBOX, [eventId, eventId]);
          await t.run('UPDATE roster_meta SET ready = 1, full_at = ? WHERE event_id = ?', [at, eventId]);
        }
        await t.run(
          `UPDATE roster_meta SET since_mark = pending_mark, synced_at = ?, sync_kind = NULL,
             cursor = NULL, pending_mark = NULL WHERE event_id = ?`,
          [at, eventId],
        );
      }),

    ticket: (eventId: string, id: string) => readTicket(db, eventId, id),

    hasBooking: async (eventId: string, bookingId: string): Promise<boolean> =>
      (await db.get<{ one: number }>(
        'SELECT 1 AS one FROM roster_ticket WHERE event_id = ? AND booking_id = ? LIMIT 1',
        [eventId, bookingId],
      )) !== null,

    bookingProgress: async (eventId: string, bookingId: string) => {
      const r = await db.get<{ total: number; checked_in: number }>(
        'SELECT count(*) AS total, count(checked_in_at) AS checked_in FROM roster_ticket WHERE event_id = ? AND booking_id = ?',
        [eventId, bookingId],
      );
      return { total: r?.total ?? 0, checkedIn: r?.checked_in ?? 0 };
    },

    counts: async (eventId: string) => {
      const r = await db.get<{ total: number; admitted: number }>(
        'SELECT count(*) AS total, count(checked_in_at) AS admitted FROM roster_ticket WHERE event_id = ?',
        [eventId],
      );
      return { admitted: r?.admitted ?? 0, total: r?.total ?? 0 };
    },

    markCheckedIn: async (
      eventId: string,
      id: string,
      at: string,
      byMe: boolean | null,
      scannedBy: string | null,
    ): Promise<void> => {
      await db.run(
        'UPDATE roster_ticket SET checked_in_at = ?, by_me = ?, scanned_by = ? WHERE event_id = ? AND id = ? AND checked_in_at IS NULL',
        [at, byMe === null ? null : byMe ? 1 : 0, scannedBy, eventId, id],
      );
    },

    setKeys: async (eventId: string, keys: TicketKey[]): Promise<void> => {
      await db.run('UPDATE roster_meta SET keys = ? WHERE event_id = ?', [JSON.stringify(keys), eventId]);
    },

    setEndsAt: async (eventId: string, endsAt: number): Promise<void> => {
      await db.run('UPDATE roster_meta SET ends_at = ? WHERE event_id = ?', [endsAt, eventId]);
    },

    expired: async (nowMs: number): Promise<string[]> =>
      (
        await db.all<{ event_id: string }>(
          'SELECT event_id FROM roster_meta WHERE ends_at IS NOT NULL AND ends_at < ?',
          [nowMs],
        )
      ).map((r) => r.event_id),

    drop: (eventId: string): Promise<void> =>
      db.tx(async (t) => {
        await t.run('DELETE FROM roster_ticket WHERE event_id = ?', [eventId]);
        await t.run('DELETE FROM roster_staging WHERE event_id = ?', [eventId]);
        await t.run('DELETE FROM roster_meta WHERE event_id = ?', [eventId]);
      }),
  };
}

export type RosterStore = ReturnType<typeof createRosterStore>;
