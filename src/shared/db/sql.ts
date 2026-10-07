export type SqlValue = string | number | null;

// The slice of a SQLite connection the app uses. expo-sqlite implements it on devices
// (expoSql.ts); node:sqlite implements it in tests, so the real SQL is unit-tested.
export type Sql = {
  exec: (sql: string) => Promise<void>;
  run: (sql: string, params?: readonly SqlValue[]) => Promise<{ changes: number }>;
  get: <T>(sql: string, params?: readonly SqlValue[]) => Promise<T | null>;
  all: <T>(sql: string, params?: readonly SqlValue[]) => Promise<T[]>;
  /**
   * One transaction, exclusive within the app. Inside `fn`, use only `t`: calling the outer
   * handle there waits for this very transaction and deadlocks.
   */
  tx: <T>(fn: (t: Sql) => Promise<T>) => Promise<T>;
};

export type DirectSql = Omit<Sql, 'tx'>;

// Every statement goes through one queue on one connection. expo-sqlite's
// withExclusiveTransactionAsync opens a second connection, which would not carry the SQLCipher
// key, and withTransactionAsync lets other callers' statements join; a queue avoids both.
export function serialSql(d: DirectSql): Sql {
  let tail: Promise<unknown> = Promise.resolve();
  const queued = <T>(f: () => Promise<T>): Promise<T> => {
    const p = tail.then(f, f);
    tail = p.catch(() => undefined);
    return p;
  };
  const inTx: Sql = {
    ...d,
    tx: () => Promise.reject(new Error('nested transactions are not supported')),
  };
  return {
    exec: (s) => queued(() => d.exec(s)),
    run: (s, p) => queued(() => d.run(s, p)),
    get: <T>(s: string, p?: readonly SqlValue[]) => queued(() => d.get<T>(s, p)),
    all: <T>(s: string, p?: readonly SqlValue[]) => queued(() => d.all<T>(s, p)),
    tx: <T>(fn: (t: Sql) => Promise<T>) =>
      queued(async () => {
        await d.exec('BEGIN IMMEDIATE');
        try {
          const v = await fn(inTx);
          await d.exec('COMMIT');
          return v;
        } catch (e) {
          await d.exec('ROLLBACK').catch(() => undefined);
          throw e;
        }
      }),
  };
}

/** migrations[i] moves the database from user_version i to i + 1, each in its own transaction. */
export async function migrate(db: Sql, migrations: readonly string[]): Promise<void> {
  const row = await db.get<{ user_version: number }>('PRAGMA user_version');
  for (let v = row?.user_version ?? 0; v < migrations.length; v++) {
    const step = migrations[v];
    if (step === undefined) return;
    await db.tx(async (t) => {
      await t.exec(step);
      await t.exec(`PRAGMA user_version = ${String(v + 1)}`);
    });
  }
}
