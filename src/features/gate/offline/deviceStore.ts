import { LOCK_MS, MAX_FAILURES, NO_LOCK, type LockRecord } from '@/features/gate/domain/overrideLock';
import type { Sql } from '@/shared/db/sql';
import type { KeyValue } from '@/shared/lib/kv';

export type ShiftTally = { admitted: number; used: number; refused: number; couldntCheck: number };
export const EMPTY_TALLY: ShiftTally = { admitted: 0, used: 0, refused: 0, couldntCheck: 0 };

const LOCK_KEY = 'override_lock';
const TALLY_KEY = 'shift_tally';
const UPSERT = 'INSERT INTO device (k, v) VALUES (?, ?) ON CONFLICT (k) DO UPDATE SET v = excluded.v';

const isLock = (v: unknown): v is LockRecord =>
  typeof v === 'object' && v !== null && 'failures' in v && typeof v.failures === 'number' &&
  'lockedUntil' in v && (v.lockedUntil === null || typeof v.lockedUntil === 'number');
const isTally = (v: unknown): v is ShiftTally =>
  typeof v === 'object' && v !== null &&
  (['admitted', 'used', 'refused', 'couldntCheck'] as const).every((k) => k in v && typeof (v as Record<string, unknown>)[k] === 'number');

// The tally lives in the encrypted DB's key/value table (wiped with the account's data at sign-out).
// The override lockout lives in `lockKv` (SecureStore), which must survive sign-out, otherwise signing
// out and in would reset the attempt counter.
export function createDeviceStore(db: Sql, deps: { now?: () => number; lockKv: KeyValue }) {
  const now = deps.now ?? (() => Date.now());
  const read = async (k: string): Promise<unknown> => {
    const r = await db.get<{ v: string }>('SELECT v FROM device WHERE k = ?', [k]);
    if (r === null) return undefined;
    try {
      return JSON.parse(r.v) as unknown;
    } catch {
      return null;
    }
  };
  const write = async (k: string, v: unknown): Promise<void> => {
    await db.run(UPSERT, [k, JSON.stringify(v)]);
  };
  return {
    lock: async (): Promise<LockRecord> => {
      const text = await deps.lockKv.get(LOCK_KEY);
      if (text === null) return NO_LOCK;
      let v: unknown = null;
      try {
        v = JSON.parse(text);
      } catch {
        v = null;
      }
      if (isLock(v)) return v;
      // Unreadable: fail closed (spec §5), and save it so it expires like a real lockout.
      const closed: LockRecord = { failures: MAX_FAILURES, lockedUntil: now() + LOCK_MS };
      await deps.lockKv.set(LOCK_KEY, JSON.stringify(closed));
      return closed;
    },
    setLock: (r: LockRecord): Promise<void> => deps.lockKv.set(LOCK_KEY, JSON.stringify(r)),
    tally: async (): Promise<ShiftTally> => {
      const v = await read(TALLY_KEY);
      return isTally(v) ? v : EMPTY_TALLY;
    },
    addToTally: (k: keyof ShiftTally): Promise<void> =>
      db.tx(async (t) => {
        const r = await t.get<{ v: string }>('SELECT v FROM device WHERE k = ?', [TALLY_KEY]);
        let cur: ShiftTally = EMPTY_TALLY;
        try {
          const parsed: unknown = r === null ? null : JSON.parse(r.v);
          if (isTally(parsed)) cur = parsed;
        } catch {
          cur = EMPTY_TALLY;
        }
        await t.run(UPSERT, [TALLY_KEY, JSON.stringify({ ...cur, [k]: cur[k] + 1 })]);
      }),
    resetTally: (): Promise<void> => write(TALLY_KEY, EMPTY_TALLY),
  };
}

export type DeviceStore = ReturnType<typeof createDeviceStore>;
