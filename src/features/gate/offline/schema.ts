// The gate's offline database (spec §3). PII columns are exactly what the roster endpoint
// returns: holder name and a masked phone, never email or a full number (DECISION-8).
const ROSTER_COLUMNS = `
  event_id TEXT NOT NULL,
  id TEXT NOT NULL,
  ticket_type TEXT,
  ticket_index INTEGER,
  booking_id TEXT NOT NULL,
  booking_status TEXT NOT NULL,
  checked_in_at TEXT,
  scanned_by TEXT,
  by_me INTEGER,
  holder_name TEXT,
  phone_masked TEXT,
  seat TEXT,
  PRIMARY KEY (event_id, id)`;

export const MIGRATIONS: readonly string[] = [
  `
  CREATE TABLE roster_ticket (${ROSTER_COLUMNS}) WITHOUT ROWID;
  CREATE INDEX roster_ticket_booking ON roster_ticket (event_id, booking_id);
  CREATE TABLE roster_staging (${ROSTER_COLUMNS}) WITHOUT ROWID;
  CREATE TABLE roster_meta (
    event_id TEXT PRIMARY KEY,
    title TEXT,
    event_date TEXT,
    require_dynamic INTEGER NOT NULL DEFAULT 0,
    total INTEGER NOT NULL DEFAULT 0,
    keys TEXT NOT NULL DEFAULT '[]',
    ready INTEGER NOT NULL DEFAULT 0,
    sync_kind TEXT,
    cursor TEXT,
    pending_mark TEXT,
    since_mark TEXT,
    synced_at INTEGER,
    full_at INTEGER,
    ends_at INTEGER
  );
  CREATE TABLE outbox (
    client_seq INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    ticket_id TEXT NOT NULL,
    code TEXT NOT NULL,
    scanned_at TEXT NOT NULL,
    mode TEXT NOT NULL,
    kid TEXT,
    app_version TEXT NOT NULL,
    state TEXT NOT NULL,
    attempts INTEGER NOT NULL DEFAULT 0,
    next_try_at INTEGER NOT NULL DEFAULT 0,
    result TEXT
  );
  CREATE INDEX outbox_event_state ON outbox (event_id, state, client_seq);
  CREATE TABLE device (k TEXT PRIMARY KEY, v TEXT NOT NULL);
  `,
  // 2b: the supervisor-override verifier (first roster page), and reason / approver on outbox items.
  `
  ALTER TABLE roster_meta ADD COLUMN override TEXT;
  ALTER TABLE outbox ADD COLUMN reason TEXT;
  ALTER TABLE outbox ADD COLUMN approved_by TEXT;
  `,
];
