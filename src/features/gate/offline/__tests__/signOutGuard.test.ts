import '@/features/gate/offline/signOutGuard';
import { gateDb } from '@/features/gate/offline/gateDb';
import { DatabaseTooNewError } from '@/shared/db/sql';
import { checkSignOut } from '@/shared/lib/signOutGuard';

jest.mock('@/features/gate/offline/gateDb', () => ({
  gateDb: jest.fn(),
  hasGateDb: () => Promise.resolve(true),
  wipeGateDb: jest.fn(),
}));
jest.mock('@/features/gate/api/batch', () => ({ postBatch: jest.fn() }));
jest.mock('@/shared/api/instance', () => ({ api: {} }));
jest.mock('@/shared/monitoring', () => ({ captureException: jest.fn() }));

it('a gate database from a newer app version flags the check instead of failing it', async () => {
  jest.mocked(gateDb).mockRejectedValue(new DatabaseTooNewError(3, 2));
  expect(await checkSignOut('u1')).toEqual({ unsynced: 0, unsyncable: 0, appOutdated: true });
});

it('any other failure still fails the check', async () => {
  jest.mocked(gateDb).mockRejectedValue(new Error('disk'));
  await expect(checkSignOut('u1')).rejects.toThrow('disk');
});
