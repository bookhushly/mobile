import type { ScanOutcome } from './outcome';
import type { TicketCode } from './parseTicketCode';
import { HOLD_ADMITTED_MS, HOLD_USED_MS } from './present';

export type OverlayItem = {
  id: number;
  code: TicketCode | null;
  outcome: ScanOutcome;
  shownAt: number | null;
  extraAdmitted: number;
};

function holdOf(o: ScanOutcome): number | null {
  switch (o.kind) {
    case 'admitted':
      return HOLD_ADMITTED_MS;
    case 'used':
      return HOLD_USED_MS;
    case 'refused':
    case 'couldntCheck':
      return null;
  }
}

export function createOverlayQueue(deps: { now: () => number; collapseAfter?: number }) {
  const collapseAfter = deps.collapseAfter ?? 3;
  let nextId = 1;
  let current: OverlayItem | null = null;
  let waiting: OverlayItem[] = [];

  function advance() {
    let next = waiting.shift() ?? null;
    if (next !== null && waiting.length + 1 > collapseAfter) {
      // A run of greens must never bury a red: fold admitted results into a count.
      const all = [next, ...waiting];
      const admitted = all.filter((i) => i.outcome.kind === 'admitted');
      const rest = all.filter((i) => i.outcome.kind !== 'admitted');
      if (rest.length > 0) {
        next = { ...(rest[0] ?? next), extraAdmitted: admitted.length };
        waiting = rest.slice(1);
      } else {
        next = { ...(admitted[admitted.length - 1] ?? next), extraAdmitted: admitted.length - 1 };
        waiting = [];
      }
    }
    current = next === null ? null : { ...next, shownAt: deps.now() };
  }

  const items = () => (current === null ? waiting : [current, ...waiting]);

  return {
    /** False when an identical (code, kind) is already showing or waiting: one overlay per presentation. */
    push(code: TicketCode | null, outcome: ScanOutcome): boolean {
      if (
        code !== null &&
        items().some((i) => i.code === code && i.outcome.kind === outcome.kind)
      ) {
        return false;
      }
      const item: OverlayItem = { id: nextId++, code, outcome, shownAt: null, extraAdmitted: 0 };
      if (current === null) current = { ...item, shownAt: deps.now() };
      else waiting.push(item);
      return true;
    },
    hasCode: (code: TicketCode) => items().some((i) => i.code === code),
    current: () => current,
    dismiss() {
      if (current !== null) advance();
    },
    tick(): boolean {
      if (current === null || current.shownAt === null) return false;
      const hold = holdOf(current.outcome);
      if (hold === null || deps.now() < current.shownAt + hold) return false;
      advance();
      return true;
    },
    nextDeadline(): number | null {
      if (current === null || current.shownAt === null) return null;
      const hold = holdOf(current.outcome);
      return hold === null ? null : current.shownAt + hold;
    },
    waitingCount: () => waiting.length,
    clear() {
      current = null;
      waiting = [];
    },
  };
}

export type OverlayQueue = ReturnType<typeof createOverlayQueue>;
