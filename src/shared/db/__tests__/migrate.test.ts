import { DatabaseTooNewError, migrate } from '@/shared/db/sql';
import { MIGRATIONS } from '@/features/gate/offline/schema';

import { nodeSql } from './nodeSql';

describe('migrate', () => {
  it('runs each migration once and records user_version', async () => {
    const db = nodeSql();
    await migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (y)']);
    await migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (y)']);
    expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: 2,
    });
  });
  it('a failing migration leaves the version where it was', async () => {
    const db = nodeSql();
    await expect(migrate(db, ['CREATE TABLE a (x)', 'NOT SQL'])).rejects.toThrow();
    expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: 1,
    });
  });
  it('a database newer than the code is refused and left as it is', async () => {
    // An OTA rollback can run older code against a database a newer update migrated.
    const db = nodeSql();
    await migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (y)', 'CREATE TABLE c (z)']);
    await db.run('INSERT INTO a (x) VALUES (?)', ['kept']);
    const err = await migrate(db, ['CREATE TABLE a (x)', 'CREATE TABLE b (y)']).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(DatabaseTooNewError);
    expect(err).toMatchObject({ found: 3, known: 2 });
    expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
      user_version: 3,
    });
    expect(await db.all<{ x: string }>('SELECT x FROM a')).toEqual([{ x: 'kept' }]);
  });
  it('concurrent transactions run one after another', async () => {
    const db = nodeSql();
    await db.exec('CREATE TABLE n (v INTEGER)');
    await Promise.all(
      [1, 2, 3].map((v) =>
        db.tx(async (t) => {
          await t.run('INSERT INTO n (v) VALUES (?)', [v]);
          await t.run('INSERT INTO n (v) VALUES (?)', [v]);
        }),
      ),
    );
    expect(await db.all<{ v: number }>('SELECT v FROM n')).toHaveLength(6);
  });
  it('the gate schema applies cleanly', async () => {
    const db = nodeSql();
    await migrate(db, MIGRATIONS);
    const tables = await db.all<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
    );
    expect(tables.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'device',
        'outbox',
        'roster_meta',
        'roster_staging',
        'roster_ticket',
      ]),
    );
  });
});
