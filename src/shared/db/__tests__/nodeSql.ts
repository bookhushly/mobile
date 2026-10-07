import { DatabaseSync } from 'node:sqlite';

import { serialSql, type Sql, type SqlValue } from '@/shared/db/sql';

// Runs the app's real SQL under Jest on Node's built-in SQLite (not SQLCipher: encryption is
// verified on a device, Task 17). Same serial queue as the device adapter.
export function nodeSql(): Sql {
  const db = new DatabaseSync(':memory:');
  const later = <T>(f: () => T): Promise<T> =>
    new Promise<T>((resolve) => {
      resolve(f());
    });
  return serialSql({
    exec: (s) =>
      later(() => {
        db.exec(s);
      }),
    run: (s, p: readonly SqlValue[] = []) =>
      later(() => ({ changes: Number(db.prepare(s).run(...p).changes) })),
    get: <T>(s: string, p: readonly SqlValue[] = []) =>
      later(() => (db.prepare(s).get(...p) as T | undefined) ?? null),
    all: <T>(s: string, p: readonly SqlValue[] = []) => later(() => db.prepare(s).all(...p) as T[]),
  });
}
