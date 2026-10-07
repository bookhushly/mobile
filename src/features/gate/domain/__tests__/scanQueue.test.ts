import { createScanQueue, type ScanQueueDeps } from '@/features/gate/domain/scanQueue';
import type { ScanOutcome, ScanResponse } from '@/features/gate/domain/outcome';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';
import { fx } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody } from '@/features/gate/schemas/scan';
import { errorFromResponse } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const code = (n: number): TicketCode => {
  const p = parseTicketCode(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  if (!p) throw new Error('bad fixture');
  return p.value;
};
const H = { get: () => null };
const ADMIT: ScanResponse = ok(admitBody.parse(fx.admitted.body));
const fail = (f: { status: number; body: unknown }): ScanResponse =>
  err(errorFromResponse(f.status, f.body, H));
const TIMEOUT: ScanResponse = err({ kind: 'timeout' });
const NETWORK: ScanResponse = err({ kind: 'network' });

type Deferred = { resolve: (r: ScanResponse) => void };
const flush = () => new Promise<void>((r) => setImmediate(r));

function harness(over: Partial<ScanQueueDeps> = {}) {
  let t = Date.parse('2026-10-05T18:00:00.000Z');
  let local = 0;
  const pending: Deferred[] = [];
  const results: { code: TicketCode; outcome: ScanOutcome }[] = [];
  const sleeps: number[] = [];
  const submit = jest.fn(
    () =>
      new Promise<ScanResponse>((resolve) => {
        pending.push({ resolve });
      }),
  );
  const q = createScanQueue({
    submit,
    onResult: (c, o) => results.push({ code: c, outcome: o }),
    now: () => t,
    localNow: () => local,
    random: () => 0,
    sleep: (ms) => {
      sleeps.push(ms);
      return Promise.resolve();
    },
    ...over,
  });
  return {
    q,
    submit,
    results,
    sleeps,
    advance: (ms: number) => {
      t += ms;
      local += ms;
    },
    serverJump: (ms: number) => {
      t += ms;
    },
    answer: async (r: ScanResponse) => {
      const d = pending.shift();
      if (!d) throw new Error('nothing in flight');
      d.resolve(r);
      await flush();
    },
  };
}

describe('scan queue', () => {
  it('submits and reports the classified outcome', async () => {
    const h = harness();
    expect(h.q.enqueue(code(1))).toBe('queued');
    await h.answer(ADMIT);
    expect(h.results.map((r) => r.outcome.kind)).toEqual(['admitted']);
    expect(h.q.pendingCount()).toBe(0);
  });

  it('runs at most three requests at once and keeps the rest queued', async () => {
    const h = harness();
    for (let i = 1; i <= 5; i++) h.q.enqueue(code(i));
    expect(h.submit).toHaveBeenCalledTimes(3);
    expect(h.q.pendingCount()).toBe(5);
    await h.answer(ADMIT);
    expect(h.submit).toHaveBeenCalledTimes(4);
  });

  it('ignores the same code while it is queued or in flight', () => {
    const h = harness();
    h.q.enqueue(code(1));
    expect(h.q.enqueue(code(1))).toBe('inFlight');
    expect(h.q.enqueue(code(1), { manual: true })).toBe('inFlight');
    expect(h.submit).toHaveBeenCalledTimes(1);
  });

  it('absorbs repeat camera reads for 2 s after a result, unless manual', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.notFound));
    expect(h.q.enqueue(code(1))).toBe('cooldown');
    expect(h.q.enqueue(code(1), { manual: true })).toBe('queued');
    await h.answer(fail(fx.notFound));
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('queued');
  });

  it('replays a settled code as already used on this phone without a request', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(ADMIT);
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('replayed');
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.results[1]?.outcome).toMatchObject({
      kind: 'used',
      scannedBy: { kind: 'me' },
      replayed: true,
    });
  });

  it('retries transient failures twice with 400 ms × attempt backoff', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.lookupFailed));
    await h.answer(fail(fx.rateLimited));
    await h.answer(ADMIT);
    expect(h.submit).toHaveBeenCalledTimes(3);
    expect(h.sleeps).toEqual([400, 800]);
    expect(h.results.map((r) => r.outcome.kind)).toEqual(['admitted']);
  });

  it("gives up after two retries with couldn't check", async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(NETWORK);
    await h.answer(fail(fx.lookupFailed));
    await h.answer(NETWORK);
    expect(h.submit).toHaveBeenCalledTimes(3);
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'network' });
  });

  it("retries a timeout only once: timeout, timeout → couldn't check after 2 submits", async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    await h.answer(TIMEOUT);
    expect(h.submit).toHaveBeenCalledTimes(2);
    expect(h.sleeps).toEqual([400]);
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'timeout' });
  });

  it('a timeout uses up the timeout budget but other transients can still retry', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    await h.answer(NETWORK);
    await h.answer(ADMIT);
    expect(h.submit).toHaveBeenCalledTimes(3);
    expect(h.results.map((r) => r.outcome.kind)).toEqual(['admitted']);
  });

  it('a camera sighting during the cooldown slides it forward', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.notFound));
    h.advance(1900);
    expect(h.q.enqueue(code(1))).toBe('cooldown');
    h.advance(1900);
    expect(h.q.enqueue(code(1))).toBe('cooldown');
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('queued');
    expect(h.submit).toHaveBeenCalledTimes(2);
  });

  it('a code seen every 100 ms for 10 s after admission is submitted once and never replayed', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(ADMIT);
    for (let i = 0; i < 100; i++) {
      h.advance(100);
      h.q.enqueue(code(1));
    }
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.results.map((r) => r.outcome.kind)).toEqual(['admitted']);
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('replayed');
    expect(h.results.map((r) => r.outcome.kind)).toEqual(['admitted', 'used']);
  });

  it('touch extends an existing cooldown without submitting', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.notFound));
    h.advance(1900);
    h.q.touch(code(1));
    h.advance(1900);
    expect(h.q.enqueue(code(1))).toBe('cooldown');
    expect(h.submit).toHaveBeenCalledTimes(1);
  });

  it('cooldowns run on the local clock, not the server clock', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.notFound));
    h.serverJump(60_000);
    expect(h.q.enqueue(code(1))).toBe('cooldown');
    h.serverJump(-120_000);
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('queued');
  });

  it.each([fx.notFound, fx.forbidden, fx.wrongEvent, fx.unauthorized, fx.invalidStatic])(
    'never retries a business answer or auth failure %#',
    async (f) => {
      const h = harness();
      h.q.enqueue(code(1));
      await h.answer(fail(f));
      expect(h.submit).toHaveBeenCalledTimes(1);
    },
  );

  it('timeout then already used → used by me', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    const usedNow = {
      status: 409,
      body: { ...fx.usedByName.body, checked_in_at: '2026-10-05T18:00:00.500Z' },
    };
    await h.answer(fail(usedNow));
    expect(h.results[0]?.outcome).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });

  it('429 then already used → not by me (a 429 never reached the database)', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(fail(fx.rateLimited));
    await h.answer(fail(fx.usedByName));
    expect(h.results[0]?.outcome).toMatchObject({ scannedBy: { kind: 'named', name: 'Ada Gate' } });
  });

  it("remembers an uncertain couldn't-check so Try again shows used by me", async () => {
    const h = harness();
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    await h.answer(TIMEOUT);
    h.q.enqueue(code(1), { manual: true });
    await h.answer(
      fail({
        status: 409,
        body: { ...fx.usedByName.body, checked_in_at: '2026-10-05T18:00:01.000Z' },
      }),
    );
    expect(h.results[1]?.outcome).toMatchObject({ kind: 'used', scannedBy: { kind: 'me' } });
  });

  it("does not remember fixable refusals, not-assigned or couldn't check", async () => {
    const h = harness();
    for (const f of [fx.expiredCode, fx.staticNotAllowed, fx.forbidden]) {
      h.q.enqueue(code(1), { manual: true });
      await h.answer(fail(f));
    }
    expect(h.submit).toHaveBeenCalledTimes(3);
  });

  it('evicts the oldest settled code past the cap', async () => {
    const h = harness({ maxSettled: 2 });
    for (const n of [1, 2, 3]) {
      h.q.enqueue(code(n));
      await h.answer(ADMIT);
    }
    h.advance(2001);
    expect(h.q.enqueue(code(1))).toBe('queued');
    expect(h.q.enqueue(code(3))).toBe('replayed');
  });

  it('treats a throwing submit as a network failure', async () => {
    const h = harness({ submit: () => Promise.reject(new Error('boom')), maxRetries: 0 });
    h.q.enqueue(code(1));
    await flush();
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'network' });
  });

  it('reset drops queued work, memory and late results', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    h.q.reset();
    await h.answer(ADMIT);
    expect(h.results).toEqual([]);
    expect(h.q.pendingCount()).toBe(0);
    expect(h.q.enqueue(code(1))).toBe('queued');
  });

  it('a throwing onResult does not stall the queue', async () => {
    const h = harness({
      onResult: () => {
        throw new Error('consumer bug');
      },
    });
    h.q.enqueue(code(1));
    h.q.enqueue(code(2));
    h.q.enqueue(code(3));
    h.q.enqueue(code(4));
    await h.answer(ADMIT);
    expect(h.submit).toHaveBeenCalledTimes(4);
  });

  it('does not retry for an old event after reset', async () => {
    const h = harness();
    h.q.enqueue(code(1));
    h.q.reset();
    await h.answer(TIMEOUT);
    await flush();
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.results).toEqual([]);
  });

  it("a run that throws still settles as couldn't check and frees the code", async () => {
    const h = harness({
      sleep: () => {
        throw new Error('x');
      },
    });
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'network' });
    expect(h.q.pendingCount()).toBe(0);
    expect(h.q.enqueue(code(1), { manual: true })).toBe('queued');
  });
});

describe('offline fallback (Phase 2a)', () => {
  const OFFLINE_ADMIT: ScanOutcome = {
    kind: 'admitted',
    offline: true,
    ticketType: null,
    ticketIndex: null,
    totalTickets: null,
    checkedInCount: null,
    checkedInAt: null,
  };

  it('network failure after retries → the local decision is shown', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const h = harness({ fallback, maxRetries: 0 });
    h.q.enqueue(code(1));
    await h.answer(NETWORK);
    expect(fallback).toHaveBeenCalledWith(code(1));
    expect(h.results).toEqual([{ code: code(1), outcome: OFFLINE_ADMIT }]);
  });

  it('a rate limit is not a reason to decide locally', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const h = harness({ fallback, maxRetries: 0 });
    h.q.enqueue(code(1));
    await h.answer(fail({ status: 429, body: {} }));
    expect(fallback).not.toHaveBeenCalled();
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'rateLimited' });
  });

  it('a server answer is final and teaches the list', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const onLive = jest.fn();
    const h = harness({ fallback, onLive });
    h.q.enqueue(code(1));
    await h.answer(ADMIT);
    expect(fallback).not.toHaveBeenCalled();
    expect(onLive).toHaveBeenCalledWith(code(1), expect.objectContaining({ kind: 'admitted' }));
  });

  it('degraded: decides locally without calling the server', async () => {
    const fallback = jest.fn(() => Promise.resolve(OFFLINE_ADMIT));
    const h = harness({ fallback, skipOnline: () => true });
    h.q.enqueue(code(1));
    await flush();
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.results[0]?.outcome).toEqual(OFFLINE_ADMIT);
  });

  it('degraded but no offline list: tries the server anyway', async () => {
    const fallback = jest.fn(() =>
      Promise.resolve<ScanOutcome>({ kind: 'couldntCheck', cause: 'noOfflineList' }),
    );
    const h = harness({ fallback, skipOnline: () => true });
    h.q.enqueue(code(1));
    await flush();
    expect(h.submit).toHaveBeenCalled();
  });

  it('a failing local decision leaves the live "couldnt check"', async () => {
    const h = harness({ fallback: () => Promise.reject(new Error('disk')), maxRetries: 0 });
    h.q.enqueue(code(1));
    await h.answer(TIMEOUT);
    expect(h.results[0]?.outcome).toEqual({ kind: 'couldntCheck', cause: 'timeout' });
  });

  it('a reset during the local decision emits nothing', async () => {
    let release: (o: ScanOutcome) => void = () => undefined;
    const fallback = jest.fn(
      () =>
        new Promise<ScanOutcome>((resolve) => {
          release = resolve;
        }),
    );
    const h = harness({ fallback, maxRetries: 0 });
    h.q.enqueue(code(1));
    await h.answer(NETWORK);
    h.q.reset();
    release(OFFLINE_ADMIT);
    await flush();
    expect(h.results).toEqual([]);
  });

  it('an offline admission replays as already used on this phone', async () => {
    const h = harness({
      fallback: () => Promise.resolve(OFFLINE_ADMIT),
      skipOnline: () => true,
      cooldownMs: 0,
    });
    h.q.enqueue(code(1));
    await flush();
    h.q.enqueue(code(1));
    expect(h.results[1]?.outcome).toMatchObject({
      kind: 'used',
      scannedBy: { kind: 'me' },
      replayed: true,
    });
  });
});
