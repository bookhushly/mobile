import { createClock } from '@/shared/lib/clock';
import { memoryKv } from '@/shared/lib/kv';

const DEVICE_NOW = Date.parse('2026-10-04T12:00:00Z');

describe('clock', () => {
  it('records the offset from a valid Date header and persists it', async () => {
    const kv = memoryKv();
    const clock = createClock({ storage: kv, now: () => DEVICE_NOW });
    clock.recordServerDate('Sun, 04 Oct 2026 12:05:00 GMT');
    expect(clock.offsetMs()).toBe(5 * 60 * 1000);
    expect(clock.serverNow()).toBe(DEVICE_NOW + 5 * 60 * 1000);

    await new Promise<void>((r) => setImmediate(r));
    const reloaded = createClock({ storage: kv, now: () => DEVICE_NOW });
    await reloaded.load();
    expect(reloaded.offsetMs()).toBe(5 * 60 * 1000);
  });

  it('ignores a missing or garbled header and keeps the previous offset', () => {
    const clock = createClock({ storage: memoryKv(), now: () => DEVICE_NOW });
    clock.recordServerDate('Sun, 04 Oct 2026 12:00:30 GMT');
    clock.recordServerDate(null);
    clock.recordServerDate('not a date');
    expect(clock.offsetMs()).toBe(30_000);
  });

  it('ignores an absurd offset (>1 day) rather than trusting it', () => {
    const clock = createClock({ storage: memoryKv(), now: () => DEVICE_NOW });
    clock.recordServerDate('Sun, 05 Oct 2027 12:00:00 GMT');
    expect(clock.offsetMs()).toBe(0);
  });

  it('updates the offset synchronously and survives a storage write that fails', async () => {
    const storage = { ...memoryKv(), set: jest.fn(() => Promise.reject(new Error('disk full'))) };
    const clock = createClock({ storage, now: () => DEVICE_NOW });
    expect(() => {
      clock.recordServerDate('Sun, 04 Oct 2026 12:00:30 GMT');
    }).not.toThrow();
    expect(clock.offsetMs()).toBe(30_000);
    expect(storage.set).toHaveBeenCalled();
    await new Promise<void>((r) => setImmediate(r));
  });

  it('remembers when the server was last heard from, across reloads', async () => {
    const kv = memoryKv();
    const clock = createClock({ storage: kv, now: () => DEVICE_NOW });
    clock.recordServerDate('Sun, 04 Oct 2026 12:30:00 GMT');
    await Promise.resolve();
    expect(clock.lastContactMs()).toBe(Date.parse('Sun, 04 Oct 2026 12:30:00 GMT'));
    const reloaded = createClock({ storage: kv, now: () => DEVICE_NOW });
    await reloaded.load();
    expect(reloaded.lastContactMs()).toBe(Date.parse('Sun, 04 Oct 2026 12:30:00 GMT'));
    expect(reloaded.offsetMs()).toBe(clock.offsetMs());
  });

  it('loads an offset saved by Phase 1 (a bare number) with no contact time', async () => {
    const kv = memoryKv();
    await kv.set('bh.clock.offset', '1500');
    const clock = createClock({ storage: kv, now: () => DEVICE_NOW });
    await clock.load();
    expect(clock.offsetMs()).toBe(1500);
    expect(clock.lastContactMs()).toBeNull();
  });
});
