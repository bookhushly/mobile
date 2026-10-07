import type { ScanOutcome } from './outcome';
import { refusedLocally } from './outcome';
import { createOverlayQueue } from './overlayQueue';
import { parseTicketCode, type TicketCode } from './parseTicketCode';
import { present, type Cue } from './present';
import { createScanQueue, type ScanQueueDeps } from './scanQueue';

export type OverlayView = {
  id: number;
  code: TicketCode | null;
  outcome: ScanOutcome;
  extraAdmitted: number;
};
export type SessionView = { current: OverlayView | null; waiting: number; pending: number };

// `localNow` (monotonic) drives overlay holds and cooldowns; `now` (server clock) only feeds
// uncertainSince and the wording of times.
export type ScanSessionDeps = Omit<ScanQueueDeps, 'onResult'> & {
  onChange: (v: SessionView) => void;
  onCue: (cue: Cue) => void;
  onAdmitted: () => void;
};

const JUNK_COOLDOWN_MS = 2_000;

type Snapshot = { id: number | null; extra: number; waiting: number; pending: number };
const sameSnapshot = (a: Snapshot | null, b: Snapshot) =>
  a !== null &&
  a.id === b.id &&
  a.extra === b.extra &&
  a.waiting === b.waiting &&
  a.pending === b.pending;

export function createScanSession(deps: ScanSessionDeps) {
  const overlays = createOverlayQueue({ now: deps.localNow });
  const junkUntil = new Map<string, number>();
  let shownId: number | null = null;
  let notAssignedShown = false;
  let last: Snapshot | null = null;

  const queue = createScanQueue({
    ...deps,
    onResult: (code, outcome) => {
      overlays.push(code, outcome);
      if (outcome.kind === 'admitted') deps.onAdmitted();
      publish();
    },
  });

  function view(): SessionView {
    const c = overlays.current();
    return {
      current:
        c === null
          ? null
          : { id: c.id, code: c.code, outcome: c.outcome, extraAdmitted: c.extraAdmitted },
      waiting: overlays.waitingCount(),
      pending: queue.pendingCount(),
    };
  }

  function publish() {
    const v = view();
    const c = v.current;
    if (c !== null && c.id !== shownId) {
      try {
        deps.onCue(present(c.outcome, deps.now()).cue);
      } catch {
        // A failing cue must never hide an outcome.
      }
    }
    shownId = c?.id ?? null;
    const snap: Snapshot = {
      id: c?.id ?? null,
      extra: c?.extraAdmitted ?? 0,
      waiting: v.waiting,
      pending: v.pending,
    };
    if (sameSnapshot(last, snap)) return;
    last = snap;
    deps.onChange(v);
  }

  // Sliding: a junk QR held in view keeps extending its own cooldown.
  function junkCoolingDown(raw: string): boolean {
    const now = deps.localNow();
    const until = junkUntil.get(raw);
    if (junkUntil.size > 200) junkUntil.clear();
    junkUntil.set(raw, now + JUNK_COOLDOWN_MS);
    return until !== undefined && now < until;
  }

  return {
    scan(raw: string, source: 'camera' | 'manual') {
      const parsed = parseTicketCode(raw);
      if (parsed === null) {
        if (source === 'camera' && junkCoolingDown(raw)) return;
        overlays.push(null, refusedLocally);
        publish();
        return;
      }
      const code = parsed.value;
      // The camera keeps reporting a code that is on screen: that is the same presentation.
      if (source === 'camera' && overlays.hasCode(code)) {
        queue.touch(code);
        return;
      }
      const r = queue.enqueue(code, { manual: source === 'manual' });
      if (r === 'queued' || r === 'replayed') publish();
    },
    // A confirmed lost assignment (not a scan result): shown at most once per session.
    showNotAssigned() {
      if (notAssignedShown) return;
      notAssignedShown = true;
      overlays.push(null, { kind: 'refused', reason: 'notAssigned', fixable: false });
      publish();
    },
    // Both take the id the staff member saw: a double tap must not dismiss the next overlay unseen.
    tryAgain(id: number) {
      const c = overlays.current();
      if (c === null || c.id !== id) return;
      overlays.dismiss();
      if (c.code !== null) queue.enqueue(c.code, { manual: true });
      publish();
    },
    dismiss(id: number) {
      if (overlays.current()?.id !== id) return;
      overlays.dismiss();
      publish();
    },
    tick() {
      if (overlays.tick()) publish();
    },
    nextDeadline: () => overlays.nextDeadline(),
    reset() {
      queue.reset();
      overlays.clear();
      junkUntil.clear();
      notAssignedShown = false;
      shownId = null;
      const v = view();
      last = { id: null, extra: 0, waiting: v.waiting, pending: v.pending };
      deps.onChange(v);
    },
    view,
  };
}

export type ScanSession = ReturnType<typeof createScanSession>;
