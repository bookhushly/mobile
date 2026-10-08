import { planSignOut } from '@/features/auth/domain/signOutPlan';

describe('planSignOut', () => {
  it('nothing pending: wipe', () => {
    expect(planSignOut({ unsynced: 0, unsyncable: 0 }, {})).toBe('wipe');
  });
  it('unsynced admissions always block a normal sign-out', () => {
    expect(planSignOut({ unsynced: 3, unsyncable: 0 }, { discardUnsyncable: true })).toEqual({
      blocked: { unsynced: 3, unsyncable: 0 },
    });
  });
  it('unsyncable admissions need an explicit confirmation', () => {
    expect(planSignOut({ unsynced: 0, unsyncable: 2 }, {})).toEqual({
      blocked: { unsynced: 0, unsyncable: 2 },
    });
    expect(planSignOut({ unsynced: 0, unsyncable: 2 }, { discardUnsyncable: true })).toBe('wipe');
  });
  it('a session-expiry sign-out keeps the data for the same account', () => {
    expect(planSignOut({ unsynced: 5, unsyncable: 0 }, { keepOfflineData: true })).toBe('keep');
  });
  it('a failed check keeps the data rather than risk losing admissions', () => {
    expect(planSignOut(null, {})).toBe('keep');
  });
});
