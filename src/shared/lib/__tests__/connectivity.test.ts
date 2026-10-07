import { createConnectivity } from '@/shared/lib/connectivity';

describe('connectivity', () => {
  it('degrades after two consecutive failures, not one', () => {
    const c = createConnectivity();
    c.unreachable();
    expect(c.isDegraded()).toBe(false);
    c.unreachable();
    expect(c.isDegraded()).toBe(true);
  });
  it('any server answer resets the count and leaves degraded', () => {
    const c = createConnectivity();
    c.unreachable();
    c.reached();
    c.unreachable();
    expect(c.isDegraded()).toBe(false);
    c.unreachable();
    c.reached();
    expect(c.isDegraded()).toBe(false);
  });
  it('losing the network degrades at once; getting it back waits for a real answer', () => {
    const c = createConnectivity();
    c.networkLost();
    expect(c.isDegraded()).toBe(true);
  });
  it('notifies subscribers once per change, and a throwing subscriber is harmless', () => {
    const c = createConnectivity();
    const seen: boolean[] = [];
    c.subscribe(() => {
      throw new Error('boom');
    });
    const off = c.subscribe((d) => seen.push(d));
    c.networkLost();
    c.networkLost();
    c.reached();
    off();
    c.networkLost();
    expect(seen).toEqual([true, false]);
  });
});
