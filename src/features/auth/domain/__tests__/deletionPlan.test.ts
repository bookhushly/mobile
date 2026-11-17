import {
  unsyncedFromCheck,
  afterUncertain,
  deletionGate,
  unsyncedWarning,
} from '@/features/auth/domain/deletionPlan';

it('warns when admissions are waiting to sync', () => {
  expect(deletionGate(0)).toBe('proceed');
  expect(deletionGate(3)).toBe('warn');
});

it('a banned refresh after an uncertain delete means it went through', () => {
  expect(afterUncertain({ code: 'user_banned' })).toBe('deleted');
  expect(afterUncertain({ message: 'User is banned' })).toBe('deleted');
  expect(afterUncertain({ message: 'USER IS BANNED' })).toBe('deleted');
  expect(afterUncertain({ code: 'refresh_token_not_found' })).toBe('unknown');
  expect(afterUncertain(null)).toBe('unknown');
});

it('words the unsynced warning, and says "some" when the count is unknown', () => {
  expect(unsyncedWarning(0)).toBeNull();
  expect(unsyncedWarning(1)).toBe(
    '1 admission hasn’t synced. Deleting your account removes it from this phone.',
  );
  expect(unsyncedWarning(3)).toBe(
    '3 admissions haven’t synced. Deleting your account removes them from this phone.',
  );
  expect(unsyncedWarning(-1)).toBe('Some admissions may not have synced.');
  expect(unsyncedWarning('appOutdated')).toBe(
    'Update the app first so anything saved on this phone can sync. Deleting your account now removes it from this phone.',
  );
});

describe('unsyncedFromCheck', () => {
  it('passes the unsynced count through', () => {
    expect(unsyncedFromCheck({ unsynced: 2, unsyncable: 1 })).toBe(2);
  });
  it('data from a newer app version is told apart from a count', () => {
    expect(unsyncedFromCheck({ unsynced: 0, unsyncable: 0, appOutdated: true })).toBe(
      'appOutdated',
    );
  });
});
