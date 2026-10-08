import { wipeGateDb } from '@/features/gate/offline/gateDb';
import { deleteSharedCsv } from '@/shared/platform/shareCsv';

jest.mock('@/shared/db/expoSql', () => ({ deleteDatabase: jest.fn(() => Promise.resolve()) }));
jest.mock('@/shared/platform/secureStore', () => ({
  secureKv: { delete: jest.fn(() => Promise.reject(new Error('keychain'))) },
}));
jest.mock('@/shared/platform/shareCsv', () => ({
  ACTIVITY_FILE: 'bookhushly-scan-activity.csv',
  deleteSharedCsv: jest.fn(),
}));
jest.mock('expo-crypto', () => ({}));

it('removes a leftover activity export even when a later wipe step fails', async () => {
  await expect(wipeGateDb('u1')).rejects.toThrow('keychain');
  expect(deleteSharedCsv).toHaveBeenCalledWith('bookhushly-scan-activity.csv');
});
