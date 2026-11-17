import { gateDb } from '@/features/gate/offline/gateDb';
import { openEncrypted } from '@/shared/db/expoSql';
import { DatabaseTooNewError } from '@/shared/db/sql';

import { nodeSql } from '@/shared/db/__tests__/nodeSql';

jest.mock('@/shared/db/expoSql', () => ({
  openEncrypted: jest.fn(),
  deleteDatabase: jest.fn(() => Promise.resolve()),
  isWrongKey: () => false,
}));
jest.mock('@/shared/platform/secureStore', () => ({
  secureKv: { get: jest.fn(() => Promise.resolve('k')), set: jest.fn(), delete: jest.fn() },
}));
jest.mock('@/shared/platform/shareCsv', () => ({
  ACTIVITY_FILE: 'a.csv',
  deleteSharedCsv: jest.fn(),
}));
jest.mock('@/shared/monitoring', () => ({ captureException: jest.fn() }));
jest.mock('expo-crypto', () => ({}));

it('a database newer than the app is closed again and left as it is', async () => {
  const sql = nodeSql();
  await sql.exec('PRAGMA user_version = 99');
  const close = jest.fn(() => Promise.resolve());
  jest.mocked(openEncrypted).mockResolvedValue({ sql, close });
  await expect(gateDb('u1')).rejects.toBeInstanceOf(DatabaseTooNewError);
  expect(close).toHaveBeenCalledTimes(1);
  expect(await sql.get<{ user_version: number }>('PRAGMA user_version')).toEqual({
    user_version: 99,
  });
});
