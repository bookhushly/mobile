import { createOverlayQueue } from '@/features/gate/domain/overlayQueue';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import { parseTicketCode, type TicketCode } from '@/features/gate/domain/parseTicketCode';

const code = (n: number): TicketCode => {
  const p = parseTicketCode(`00000000-0000-4000-8000-${String(n).padStart(12, '0')}`);
  if (!p) throw new Error('bad fixture');
  return p.value;
};

const A: ScanOutcome = {
  kind: 'admitted',
  ticketType: null,
  ticketIndex: null,
  totalTickets: null,
  checkedInCount: null,
  checkedInAt: null,
};
const U: ScanOutcome = {
  kind: 'used',
  checkedInAt: null,
  scannedBy: { kind: 'unknown' },
  ticketType: null,
  replayed: false,
};
const R: ScanOutcome = { kind: 'refused', reason: 'notFound', fixable: false };
const C: ScanOutcome = { kind: 'couldntCheck', cause: 'network' };

function harness() {
  let t = 0;
  const q = createOverlayQueue({ now: () => t });
  return { q, at: (ms: number) => (t = ms) };
}

describe('overlay queue', () => {
  it('shows the first result at once', () => {
    const { q } = harness();
    q.push(null, A);
    expect(q.current()).toMatchObject({ outcome: A, shownAt: 0, extraAdmitted: 0 });
  });
  it('auto-advances admitted after 1.6 s and used after 3.2 s', () => {
    const { q, at } = harness();
    q.push(null, A);
    q.push(null, U);
    at(1599);
    expect(q.tick()).toBe(false);
    at(1600);
    expect(q.tick()).toBe(true);
    expect(q.current()?.outcome).toBe(U);
    expect(q.nextDeadline()).toBe(1600 + 3200);
    at(4800);
    q.tick();
    expect(q.current()).toBeNull();
  });
  it("holds refusals and couldn't-check until dismissed", () => {
    const { q, at } = harness();
    q.push(null, R);
    at(3_600_000);
    expect(q.tick()).toBe(false);
    expect(q.nextDeadline()).toBeNull();
    q.dismiss();
    expect(q.current()).toBeNull();
  });
  it('never replaces a held overlay with a later result', () => {
    const { q } = harness();
    q.push(null, C);
    q.push(null, A);
    q.push(null, R);
    expect(q.current()?.outcome).toBe(C);
    q.dismiss();
    expect(q.current()?.outcome).toBe(A);
  });
  it('collapses queued admissions into +N when more than three wait, keeping every non-admitted', () => {
    const { q } = harness();
    q.push(null, R);
    q.push(null, A);
    q.push(null, A);
    q.push(null, U);
    q.push(null, A);
    q.dismiss();
    expect(q.current()).toMatchObject({ outcome: U, extraAdmitted: 3 });
    expect(q.waitingCount()).toBe(0);
  });
  it('a run of admissions only collapses into one admitted with the rest counted', () => {
    const { q } = harness();
    q.push(null, R);
    for (let i = 0; i < 5; i++) q.push(null, A);
    q.dismiss();
    expect(q.current()).toMatchObject({ outcome: A, extraAdmitted: 4 });
  });
  it('does not collapse three or fewer', () => {
    const { q } = harness();
    q.push(null, R);
    q.push(null, A);
    q.push(null, A);
    q.push(null, U);
    q.dismiss();
    expect(q.current()).toMatchObject({ outcome: A, extraAdmitted: 0 });
    expect(q.waitingCount()).toBe(2);
  });
  it('gives each item a new id', () => {
    const { q } = harness();
    q.push(null, R);
    const first = q.current()?.id;
    q.push(null, R);
    q.dismiss();
    expect(q.current()?.id).not.toBe(first);
  });

  it('drops a push identical in code and kind to the current or a waiting item', () => {
    const { q } = harness();
    expect(q.push(code(1), R)).toBe(true);
    expect(q.push(code(1), R)).toBe(false);
    expect(q.push(code(2), C)).toBe(true);
    expect(q.push(code(2), C)).toBe(false);
    expect(q.waitingCount()).toBe(1);
    expect(q.push(code(1), U)).toBe(true);
    expect(q.waitingCount()).toBe(2);
  });
  it('never drops codeless pushes', () => {
    const { q } = harness();
    q.push(null, R);
    expect(q.push(null, R)).toBe(true);
    expect(q.waitingCount()).toBe(1);
  });
  it('hasCode sees the current and waiting items only', () => {
    const { q } = harness();
    q.push(code(1), R);
    q.push(code(2), R);
    expect(q.hasCode(code(1))).toBe(true);
    expect(q.hasCode(code(2))).toBe(true);
    expect(q.hasCode(code(3))).toBe(false);
    q.dismiss();
    expect(q.hasCode(code(1))).toBe(false);
  });
});
