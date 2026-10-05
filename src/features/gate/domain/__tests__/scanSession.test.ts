import type { ScanResponse } from '@/features/gate/domain/outcome';
import { createScanSession, type SessionView } from '@/features/gate/domain/scanSession';
import { fx } from '@/features/gate/schemas/__fixtures__/scan';
import { admitBody } from '@/features/gate/schemas/scan';
import { errorFromResponse } from '@/shared/lib/errors';
import { err, ok } from '@/shared/lib/result';

const U1 = '3f2b8c4e-1a2b-4c3d-8e9f-0a1b2c3d4e5f';
const U2 = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const flush = () => new Promise<void>((r) => setImmediate(r));

function harness(responses: ScanResponse[]) {
  let t = 0;
  let local = 0;
  const views: SessionView[] = [];
  const cues: string[] = [];
  const onAdmitted = jest.fn();
  const onNotAssigned = jest.fn();
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
    onCue: (c) => cues.push(c),
    onAdmitted,
    onNotAssigned,
  });
  const currentId = () => s.view().current?.id ?? -1;
  return {
    s,
    submit,
    views,
    cues,
    onAdmitted,
    onNotAssigned,
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

  it('a 403 tells the screen to leave', async () => {
    const h = harness([err(errorFromResponse(403, fx.forbidden.body, { get: () => null }))]);
    h.s.scan(U1, 'camera');
    await flush();
    expect(h.onNotAssigned).toHaveBeenCalledTimes(1);
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
});
