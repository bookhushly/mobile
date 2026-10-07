import * as SQLite from 'expo-sqlite';

import { serialSql, type Sql, type SqlValue } from './sql';

const HEX_KEY = /^[0-9a-f]{64}$/;

function wrap(db: SQLite.SQLiteDatabase): Sql {
  return serialSql({
    exec: (s) => db.execAsync(s),
    run: async (s, p: readonly SqlValue[] = []) => ({
      changes: (await db.runAsync(s, [...p])).changes,
    }),
    get: <T>(s: string, p: readonly SqlValue[] = []) => db.getFirstAsync<T>(s, [...p]),
    all: <T>(s: string, p: readonly SqlValue[] = []) => db.getAllAsync<T>(s, [...p]),
  });
}

/** SQLCipher: the raw 32-byte key must be the first statement on the connection. */
export async function openEncrypted(
  name: string,
  keyHex: string,
): Promise<{ sql: Sql; close: () => Promise<void> }> {
  if (!HEX_KEY.test(keyHex)) throw new Error('database key must be 64 lowercase hex characters');
  const db = await SQLite.openDatabaseAsync(name);
  try {
    await db.execAsync(`PRAGMA key = "x'${keyHex}'"`);
    // Throws "file is not a database" when the key doesn't open this file.
    await db.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
    await db.execAsync('PRAGMA journal_mode = WAL');
  } catch (e) {
    await db.closeAsync().catch(() => undefined);
    throw e;
  }
  return { sql: wrap(db), close: () => db.closeAsync() };
}

// Android throws if the database is still open: close it first.
export const deleteDatabase = (name: string): Promise<void> => SQLite.deleteDatabaseAsync(name);

export const isWrongKey = (e: unknown): boolean =>
  e instanceof Error && /not a database/i.test(e.message);
