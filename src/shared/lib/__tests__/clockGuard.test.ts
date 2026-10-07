import { createClockGuard } from '@/shared/lib/clockGuard';

function rig() {
  let wall = Date.parse('2026-10-07T18:00:00Z');
  let mono = 0;
  let contact: number | null = wall;
  const guard = createClockGuard({
    wallNow: () => wall,
    monoNow: () => mono,
    serverNow: () => wall,
    lastContactMs: () => contact,
  });
  return {
    guard,
    tick: (ms: number) => {
      wall += ms;
      mono += ms;
    },
    moveWall: (ms: number) => {
      wall += ms;
    },
    contactNow: () => {
      contact = wall;
    },
    noContact: () => {
      contact = null;
    },
  };
}

describe('clock guard', () => {
  it('a steady clock is trusted and reports how long since the server', () => {
    const r = rig();
    r.tick(90_000);
    expect(r.guard.state()).toEqual({ suspect: false, checkedAgoMs: 90_000 });
  });
  it('a wall-clock jump over 2 minutes is suspect until the server is heard again', () => {
    const r = rig();
    r.moveWall(3 * 60_000);
    expect(r.guard.state().suspect).toBe(true);
    r.tick(1_000);
    expect(r.guard.state().suspect).toBe(true);
    r.contactNow();
    expect(r.guard.state().suspect).toBe(false);
  });
  it('a small correction is not a jump', () => {
    const r = rig();
    r.moveWall(60_000);
    expect(r.guard.state().suspect).toBe(false);
  });
  it('a clock set behind the last server contact is suspect', () => {
    const r = rig();
    r.moveWall(-30_000);
    expect(r.guard.state().suspect).toBe(true);
  });
  it('after the phone slept (monotonic clock paused), rebase prevents a false alarm', () => {
    const r = rig();
    r.moveWall(10 * 60_000);
    r.guard.rebase();
    expect(r.guard.state().suspect).toBe(false);
  });
  it('no contact yet: nothing to compare, not suspect', () => {
    const r = rig();
    r.noContact();
    expect(r.guard.state()).toEqual({ suspect: false, checkedAgoMs: null });
  });
});
