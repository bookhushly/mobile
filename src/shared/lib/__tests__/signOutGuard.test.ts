import {
  checkSignOut,
  registerSignOutGuard,
  resetShiftSummary,
  shiftSummary,
  wipeOnSignOut,
} from '@/shared/lib/signOutGuard';

it('sums every registered guard and wipes through all of them', async () => {
  const wipe = jest.fn(() => Promise.resolve());
  registerSignOutGuard({
    check: () => Promise.resolve({ unsynced: 2, unsyncable: 1 }),
    syncNow: () => Promise.resolve(),
    wipe,
  });
  expect(await checkSignOut('u1')).toEqual({ unsynced: 2, unsyncable: 1 });
  await wipeOnSignOut('u1');
  expect(wipe).toHaveBeenCalledWith('u1');
});

describe('shift summary', () => {
  const noop = () => Promise.resolve();
  const base = {
    check: () => Promise.resolve({ unsynced: 0, unsyncable: 0 }),
    syncNow: noop,
    wipe: noop,
  };
  const s = { admitted: 1, used: 0, refused: 0, couldntCheck: 0, toSync: 0 };

  it('returns the first non-null summary and resets through the guards', async () => {
    const resetSummary = jest.fn(noop);
    registerSignOutGuard({ ...base, summary: () => Promise.resolve(null) });
    registerSignOutGuard({
      ...base,
      summary: (uid) => Promise.resolve(uid === 'u1' ? s : null),
      resetSummary,
    });
    expect(await shiftSummary('u1')).toEqual(s);
    await resetShiftSummary('u1');
    expect(resetSummary).toHaveBeenCalledWith('u1');
  });

  it('returns null when a guard throws', async () => {
    registerSignOutGuard({
      ...base,
      summary: (uid) => (uid === 'u2' ? Promise.reject(new Error('db')) : Promise.resolve(null)),
    });
    expect(await shiftSummary('u2')).toBeNull();
  });
});
