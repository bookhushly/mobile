import {
  afterFailure,
  afterSuccess,
  LOCK_MS,
  lockState,
  NO_LOCK,
} from '@/features/gate/domain/overrideLock';

const T = Date.parse('2026-10-07T18:00:00Z');

describe('override lockout', () => {
  it('starts open with 5 tries', () => {
    expect(lockState(NO_LOCK, T)).toEqual({ kind: 'open', triesLeft: 5 });
  });
  it('counts down and locks on the 5th failure', () => {
    let rec = NO_LOCK;
    for (let i = 0; i < 4; i++) rec = afterFailure(rec, T);
    expect(lockState(rec, T)).toEqual({ kind: 'open', triesLeft: 1 });
    rec = afterFailure(rec, T);
    expect(rec).toEqual({ failures: 5, lockedUntil: T + LOCK_MS });
    expect(lockState(rec, T)).toEqual({ kind: 'locked', minutesLeft: 15 });
    expect(lockState(rec, T + LOCK_MS - 61_000)).toEqual({ kind: 'locked', minutesLeft: 2 });
  });
  it('unlocks when the time is up, with a fresh count', () => {
    const rec = { failures: 5, lockedUntil: T + LOCK_MS };
    expect(lockState(rec, T + LOCK_MS)).toEqual({ kind: 'open', triesLeft: 5 });
    expect(afterFailure(rec, T + LOCK_MS)).toEqual({ failures: 1, lockedUntil: null });
  });
  it('a clock that moved back never shortens the lock beyond its stored end', () => {
    const rec = { failures: 5, lockedUntil: T + LOCK_MS };
    expect(lockState(rec, T - 60 * 60_000)).toEqual({ kind: 'locked', minutesLeft: 15 });
  });
  it('a correct PIN resets the count', () => {
    expect(afterSuccess()).toEqual(NO_LOCK);
  });
});
