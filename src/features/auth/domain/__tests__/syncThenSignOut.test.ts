import { syncThenSignOut } from '@/features/auth/domain/syncThenSignOut';

describe('syncThenSignOut', () => {
  it('waits for the sync, then signs out when nothing is left', async () => {
    const order: string[] = [];
    const blocked = await syncThenSignOut({
      sync: async () => {
        await Promise.resolve();
        order.push('sync');
      },
      signOut: () => {
        order.push('signOut');
        return Promise.resolve({ blocked: null });
      },
      report: jest.fn(),
    });
    expect(order).toEqual(['sync', 'signOut']);
    expect(blocked).toBeNull();
  });
  it('a sync that throws is reported and the sign-out is still re-checked', async () => {
    const report = jest.fn();
    const signOut = jest.fn(() => Promise.resolve({ blocked: { unsynced: 2, unsyncable: 0 } }));
    const blocked = await syncThenSignOut({
      sync: () => Promise.reject(new Error('offline')),
      signOut,
      report,
    });
    expect(report).toHaveBeenCalledWith(expect.any(Error));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(blocked).toEqual({ unsynced: 2, unsyncable: 0 });
  });
});
