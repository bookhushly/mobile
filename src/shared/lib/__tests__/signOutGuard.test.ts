import { checkSignOut, registerSignOutGuard, wipeOnSignOut } from '@/shared/lib/signOutGuard';

it('sums every registered guard and wipes through all of them', async () => {
  const wipe = jest.fn(() => Promise.resolve());
  registerSignOutGuard({ check: () => Promise.resolve({ unsynced: 2, unsyncable: 1 }), syncNow: () => Promise.resolve(), wipe });
  expect(await checkSignOut('u1')).toEqual({ unsynced: 2, unsyncable: 1 });
  await wipeOnSignOut('u1');
  expect(wipe).toHaveBeenCalledWith('u1');
});
