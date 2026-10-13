import { createModeCache, withCachedMode } from '@/features/mode/domain/modeCache';
import type { ModeResolution } from '@/features/mode/domain/resolveMode';
import { memoryKv } from '@/shared/lib/kv';

type Modes = Extract<ModeResolution, { kind: 'modes' }>;

const resolution: Modes = { kind: 'modes', modes: ['gate', 'customer'], defaultMode: 'gate' };

describe('createModeCache', () => {
  it('saves modes and default only, per user, and loads them back', async () => {
    const kv = memoryKv();
    const cache = createModeCache(kv);
    await cache.save('u1', resolution);
    expect(JSON.parse(kv.dump()['bh.mode.last.u1'] ?? '')).toEqual({
      modes: ['gate', 'customer'],
      defaultMode: 'gate',
    });
    expect(await cache.load('u1')).toEqual(resolution);
    expect(await cache.load('u2')).toBeNull();
  });

  it('never caches a web-only resolution (and drops an older cache)', async () => {
    const kv = memoryKv();
    const cache = createModeCache(kv);
    await cache.save('u1', resolution);
    await cache.save('u1', { kind: 'webOnly' });
    expect(await cache.load('u1')).toBeNull();
  });

  it('rejects malformed or unknown stored values', async () => {
    const kv = memoryKv();
    const cache = createModeCache(kv);
    await kv.set('bh.mode.last.u1', '{not json');
    expect(await cache.load('u1')).toBeNull();
    await kv.set('bh.mode.last.u1', JSON.stringify({ modes: ['admin'], defaultMode: 'admin' }));
    expect(await cache.load('u1')).toBeNull();
    await kv.set('bh.mode.last.u1', JSON.stringify({ modes: [], defaultMode: 'customer' }));
    expect(await cache.load('u1')).toBeNull();
    await kv.set('bh.mode.last.u1', JSON.stringify({ modes: ['gate'], defaultMode: 'customer' }));
    expect(await cache.load('u1')).toBeNull();
  });

  it('a read failure is a miss, not an error', async () => {
    const kv = memoryKv();
    const cache = createModeCache({ ...kv, get: () => Promise.reject(new Error('io')) });
    expect(await cache.load('u1')).toBeNull();
  });

  it('wipe removes every user it saved (no user id needed)', async () => {
    const kv = memoryKv();
    const cache = createModeCache(kv);
    await cache.save('u1', resolution);
    await cache.save('u2', { kind: 'modes', modes: ['customer'], defaultMode: 'customer' });
    await cache.wipe();
    expect(kv.dump()).toEqual({});
    // A fresh process (new cache over the same storage) still finds them through the index.
    await cache.save('u3', resolution);
    await createModeCache(kv).wipe();
    expect(kv.dump()).toEqual({});
  });
});

describe('withCachedMode', () => {
  const cached: Modes = { kind: 'modes', modes: ['gate', 'customer'], defaultMode: 'gate' };

  it('fresh data wins', () => {
    expect(
      withCachedMode(
        { status: 'loading' },
        { offline: false, transientError: false },
        cached,
        null,
      ),
    ).toEqual({
      status: 'loading',
    });
  });

  it('offline (paused) with a cache -> ready, honouring the chosen mode', () => {
    expect(
      withCachedMode(
        { status: 'loading' },
        { offline: true, transientError: false },
        cached,
        'customer',
      ),
    ).toEqual({
      status: 'ready',
      resolution: { kind: 'modes', modes: ['gate', 'customer'], defaultMode: 'customer' },
    });
  });

  it('transient error with a cache -> ready', () => {
    expect(
      withCachedMode({ status: 'error' }, { offline: false, transientError: true }, cached, null),
    ).toEqual({ status: 'ready', resolution: cached });
  });

  it('a non-transient error still shows the error, cache or not', () => {
    expect(
      withCachedMode({ status: 'error' }, { offline: false, transientError: false }, cached, null),
    ).toEqual({ status: 'error' });
  });

  it('no cache -> unchanged', () => {
    expect(
      withCachedMode({ status: 'loading' }, { offline: true, transientError: false }, null, null),
    ).toEqual({ status: 'loading' });
    expect(
      withCachedMode({ status: 'error' }, { offline: false, transientError: true }, null, null),
    ).toEqual({ status: 'error' });
  });

  it('never overrides ready or idle', () => {
    const ready = { status: 'ready', resolution: { kind: 'webOnly' } } as const;
    expect(withCachedMode(ready, { offline: true, transientError: true }, cached, null)).toBe(
      ready,
    );
    expect(
      withCachedMode({ status: 'idle' }, { offline: true, transientError: true }, cached, null),
    ).toEqual({ status: 'idle' });
  });
});
