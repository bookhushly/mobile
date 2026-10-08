import { migrate } from '@/shared/db/sql';
import { nodeSql } from '@/shared/db/__tests__/nodeSql';
import { MIGRATIONS } from '@/features/gate/offline/schema';

it('migration 2 keeps existing rows and adds the new columns', async () => {
  const db = nodeSql();
  await migrate(db, MIGRATIONS.slice(0, 1));
  await db.run(
    "INSERT INTO outbox (event_id, ticket_id, code, scanned_at, mode, app_version, state) VALUES ('e', 't', 't', 'x', 'offline', '1', 'pending')",
  );
  await migrate(db, MIGRATIONS);
  expect(await db.get<{ user_version: number }>('PRAGMA user_version')).toEqual({ user_version: 2 });
  expect(await db.get('SELECT ticket_id, reason, approved_by FROM outbox')).toEqual({ ticket_id: 't', reason: null, approved_by: null });
  const cols = await db.all<{ name: string }>("SELECT name FROM pragma_table_info('roster_meta')");
  expect(cols.map((c) => c.name)).toContain('override');
});
