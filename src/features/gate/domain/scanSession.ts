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

export type ScanSessionDeps = Omit<ScanQueueDeps, 'onResult'> & {
  // Overlay hold timing. Separate from `now` (server clock, re-synced on every response, can step back).
  localNow: () => number;
  onChange: (v: SessionView) => void;
  onCue: (cue: Cue) => void;
  onAdmitted: () => void;
  onNotAssigned: () => void;
};

const JUNK_COOLDOWN_MS = 2_000;

// Phase 2 swaps `submit` for roster + outbox; nothing else here changes.
export function createScanSession(deps: ScanSessionDeps) {
  const overlays = createOverlayQueue({ now: deps.localNow });
  const junkUntil = new Map<string, number>();
  let shownId: number | null = null;

  const queue = createScanQueue({
    ...deps,
    onResult: (code, outcome) => {
      overlays.push(code, outcome);
      if (outcome.kind === 'admitted') deps.onAdmitted();
      if (outcome.kind === 'refused' && outcome.reason === 'notAssigned') deps.onNotAssigned();
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
    const c = overlays.current();
    if (c !== null && c.id !== shownId) deps.onCue(present(c.outcome, deps.now()).cue);
    shownId = c?.id ?? null;
    deps.onChange(view());
  }

  return {
    scan(raw: string, source: 'camera' | 'manual') {
      const parsed = parseTicketCode(raw);
      if (parsed === null) {
        if (source === 'camera') {
          const now = deps.now();
          const until = junkUntil.get(raw);
          if (until !== undefined && now < until) return;
          if (junkUntil.size > 200) junkUntil.clear();
          junkUntil.set(raw, now + JUNK_COOLDOWN_MS);
        }
        overlays.push(null, refusedLocally);
        publish();
        return;
      }
      queue.enqueue(parsed.value, { manual: source === 'manual' });
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
      shownId = null;
      deps.onChange(view());
    },
    view,
  };
}

export type ScanSession = ReturnType<typeof createScanSession>;
