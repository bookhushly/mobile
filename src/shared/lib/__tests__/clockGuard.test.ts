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
  // Jump tests start with no server contact so the "behind last contact" rule can't fire too.
  it('a clock set back over 2 minutes is suspect until the server is heard again', () => {
    const r = rig();
    r.noContact();
    r.moveWall(-5 * 60_000);
    expect(r.guard.state().suspect).toBe(true);
    r.tick(1_000);
    expect(r.guard.state().suspect).toBe(true);
    r.contactNow();
    expect(r.guard.state().suspect).toBe(false);
  });
  it('a forward jump of 3 minutes is never a jump', () => {
    const r = rig();
    r.moveWall(3 * 60_000);
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
  it('the phone slept 10 min (wall +10 min, monotonic paused), then rebase: not suspect', () => {
    const r = rig();
    r.moveWall(10 * 60_000);
    r.guard.rebase();
    expect(r.guard.state().suspect).toBe(false);
  });
  it('the clock set back 5 min while in the background is recorded by rebase', () => {
    const r = rig();
    r.noContact();
    r.moveWall(-5 * 60_000);
    r.guard.rebase();
    expect(r.guard.state().suspect).toBe(true);
    r.contactNow();
    expect(r.guard.state().suspect).toBe(false);
  });
  it('no contact yet: nothing to compare, not suspect', () => {
    const r = rig();
    r.noContact();
    expect(r.guard.state()).toEqual({ suspect: false, checkedAgoMs: null });
  });
});
