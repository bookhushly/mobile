import type { ScanResponse } from '@/features/gate/domain/outcome';
import { createScanSession, type SessionView } from '@/features/gate/domain/scanSession';
import { fx } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody } from '@/features/gate/schemas/scan';
import { errorFromResponse } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const U1 = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const U2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const flush = () => new Promise<void>((r) => setImmediate(r));

function harness(responses: ScanResponse[], over: { onCue?: (c: string) => void } = {}) {
  let t = 0;
  let local = 0;
  const views: SessionView[] = [];
  const cues: string[] = [];
  const onAdmitted = jest.fn();
  const submit = jest.fn(() => {
    const r = responses.shift();
    return r ? Promise.resolve(r) : Promise.reject(new Error('no response'));
  });
  const s = createScanSession({
    submit,
    now: () => t,
    localNow: () => local,
    random: () => 0,
    sleep: () => Promise.resolve(),
    maxRetries: 0,
    onChange: (v) => views.push(v),
    onCue:
      over.onCue ??
      ((c) => {
        cues.push(c);
      }),
    onAdmitted,
  });
  const currentId = () => s.view().current?.id ?? -1;
  return {
    s,
    submit,
    views,
    cues,
    onAdmitted,
    currentId,
    at: (ms: number) => {
      t = ms;
      local = ms;
    },
    setServer: (ms: number) => {
      t = ms;
    },
    setLocal: (ms: number) => {
      local = ms;
    },
  };
}

describe('scan session', () => {
  it('a non-ticket QR is refused locally without a request', async () => {
    const h = harness([]);
    h.s.scan('WIFI:S:cafe;;', 'camera');
    await flush();
    expect(h.submit).not.toHaveBeenCalled();
    expect(h.s.view().current?.outcome).toEqual({
      kind: 'refused',
      reason: 'notTicket',
      fixable: false,
    });
    expect(h.cues).toEqual(['error']);
  });

  it('the same junk QR seen repeatedly by the camera refuses once per 2 s', () => {
    const h = harness([]);
    h.s.scan('junk', 'camera');
    h.s.dismiss(h.currentId());
    h.s.scan('junk', 'camera');
    expect(h.s.view().current).toBeNull();
    h.at(2001);
    h.s.scan('junk', 'camera');
    expect(h.s.view().current).not.toBeNull();
  });

  it('admission shows the overlay, cues success and reports for summary refresh', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    expect(h.s.view().pending).toBe(1);
    await flush();
    expect(h.s.view()).toMatchObject({ pending: 0, current: { outcome: { kind: 'admitted' } } });
    expect(h.cues).toEqual(['success']);
    expect(h.onAdmitted).toHaveBeenCalledTimes(1);
  });

  it('cues fire when an overlay appears, not when it is queued', async () => {
    const h = harness([
      err(errorFromResponse(404, fx.notFound.body, { get: () => null })),
      ok(admitBody.parse(fx.admitted.body)),
    ]);
    h.s.scan(U1, 'camera');
    h.s.scan(U2, 'camera');
    await flush();
    expect(h.cues).toEqual(['error']);
    h.s.dismiss(h.currentId());
    expect(h.cues).toEqual(['error', 'success']);
  });

  it('try again resubmits the held code even inside the cooldown', async () => {
    const h = harness([err({ kind: 'timeout' }), ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    await flush();
    expect(h.s.view().current?.outcome.kind).toBe('couldntCheck');
    h.s.tryAgain(h.currentId());
    await flush();
    expect(h.submit).toHaveBeenCalledTimes(2);
    expect(h.s.view().current?.outcome.kind).toBe('admitted');
  });

  it('try again with a stale overlay id does not resubmit', async () => {
    const h = harness([err({ kind: 'timeout' }), ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    await flush();
    const id = h.currentId();
    h.s.tryAgain(id + 100);
    await flush();
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.s.view().current?.id).toBe(id);
  });

  it('a double dismiss of the first refusal leaves the second one showing', async () => {
    const h = harness([
      err(errorFromResponse(404, fx.notFound.body, { get: () => null })),
      err(errorFromResponse(404, fx.notFound.body, { get: () => null })),
    ]);
    h.s.scan(U1, 'camera');
    h.s.scan(U2, 'camera');
    await flush();
    const firstId = h.currentId();
    h.s.dismiss(firstId);
    const secondId = h.currentId();
    expect(secondId).not.toBe(firstId);
    h.s.dismiss(firstId);
    expect(h.s.view().current?.id).toBe(secondId);
  });

  it('a 403 with the forbidden code holds a not-assigned refusal on screen', async () => {
    const h = harness([err(errorFromResponse(403, fx.forbidden.body, { get: () => null }))]);
    h.s.scan(U1, 'camera');
    await flush();
    expect(h.s.view().current?.outcome).toEqual({
      kind: 'refused',
      reason: 'notAssigned',
      fixable: false,
    });
  });

  it('a codeless 403 is a couldn’t check, not a lost assignment', async () => {
    const h = harness([err(errorFromResponse(403, { error: 'Forbidden' }, { get: () => null }))]);
    h.s.scan(U1, 'camera');
    await flush();
    expect(h.s.view().current?.outcome).toEqual({ kind: 'couldntCheck', cause: 'server' });
  });

  it('tick advances a timed overlay', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    await flush();
    h.at(1600);
    h.s.tick();
    expect(h.s.view().current).toBeNull();
  });

  it('overlays advance on the local clock when the server clock steps backwards', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    h.at(5000);
    h.s.scan(U1, 'camera');
    await flush();
    h.setServer(5000 - 999);
    h.setLocal(5000 + 1600);
    h.s.tick();
    expect(h.s.view().current).toBeNull();
  });

  // One presentation = one request and one overlay, however long the QR stays in view.
  async function holdInView(
    h: ReturnType<typeof harness>,
    raw: string,
    fromMs: number,
    ms: number,
  ) {
    for (let at = fromMs; at <= fromMs + ms; at += 100) {
      h.at(at);
      h.s.tick();
      h.s.scan(raw, 'camera');
      await flush();
    }
  }

  it('an admitted code held in view for 10 s: one submit, one overlay', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    await holdInView(h, U1, 0, 10_000);
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.cues).toEqual(['success']);
  });

  it('an admitted code that leaves view for over 2 s replays once when shown again', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    await holdInView(h, U1, 0, 10_000);
    await holdInView(h, U1, 12_200, 10_000);
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.cues).toEqual(['success', 'warning']);
    expect(h.views.flatMap((v) => (v.current ? [v.current.outcome] : []))).toContainEqual(
      expect.objectContaining({ kind: 'used', replayed: true }),
    );
  });

  it('a refused code held in view for 10 s: one submit, one held overlay, none after Done', async () => {
    const h = harness([
      err(errorFromResponse(404, fx.notFound.body, { get: () => null })),
      err(errorFromResponse(404, fx.notFound.body, { get: () => null })),
    ]);
    await holdInView(h, U1, 0, 10_000);
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.cues).toEqual(['error']);
    expect(h.s.view().waiting).toBe(0);
    h.s.dismiss(h.currentId());
    await holdInView(h, U1, 10_100, 3_000);
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.s.view().current).toBeNull();
  });

  it('a junk QR held in view for 10 s: one overlay, none after Done', async () => {
    const h = harness([]);
    await holdInView(h, 'WIFI:S:cafe;;', 0, 10_000);
    expect(h.cues).toEqual(['error']);
    expect(h.s.view().waiting).toBe(0);
    h.s.dismiss(h.currentId());
    await holdInView(h, 'WIFI:S:cafe;;', 10_100, 3_000);
    expect(h.s.view().current).toBeNull();
    expect(h.submit).not.toHaveBeenCalled();
  });

  it("a held couldn't check is not resubmitted behind the overlay by the camera", async () => {
    const h = harness([err({ kind: 'network' }), ok(admitBody.parse(fx.admitted.body))]);
    await holdInView(h, U1, 0, 10_000);
    expect(h.submit).toHaveBeenCalledTimes(1);
    expect(h.s.view().current?.outcome.kind).toBe('couldntCheck');
    h.s.tryAgain(h.currentId());
    await flush();
    expect(h.submit).toHaveBeenCalledTimes(2);
    expect(h.s.view().current?.outcome.kind).toBe('admitted');
  });

  it('manual entry of the code on screen still submits', async () => {
    const h = harness([err({ kind: 'network' }), ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    await flush();
    h.s.scan(U1, 'manual');
    await flush();
    expect(h.submit).toHaveBeenCalledTimes(2);
  });

  it('ignored frames do not publish', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))]);
    h.s.scan(U1, 'camera');
    await flush();
    const before = h.views.length;
    for (let i = 0; i < 20; i++) h.s.scan(U1, 'camera');
    h.s.scan('junk', 'camera');
    const afterJunk = h.views.length;
    expect(afterJunk).toBe(before + 1);
    h.s.dismiss(h.currentId());
    const afterDismiss = h.views.length;
    for (let i = 0; i < 20; i++) h.s.scan('junk', 'camera');
    expect(h.views.length).toBe(afterDismiss);
  });

  it('a cue that throws still publishes the overlay', async () => {
    const h = harness([ok(admitBody.parse(fx.admitted.body))], {
      onCue: () => {
        throw new Error('audio died');
      },
    });
    h.s.scan(U1, 'camera');
    await flush();
    expect(h.views.at(-1)?.current?.outcome.kind).toBe('admitted');
  });

  it('cooldowns ignore server-clock steps', () => {
    const h = harness([]);
    h.s.scan('junk', 'camera');
    h.s.dismiss(h.currentId());
    h.setServer(60_000);
    h.s.scan('junk', 'camera');
    expect(h.s.view().current).toBeNull();
  });
});
