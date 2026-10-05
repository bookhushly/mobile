import { err } from '@/shared/lib/result';

import {
  classify,
  isTransient,
  mayHaveCommitted,
  replayOf,
  type ScanOutcome,
  type ScanResponse,
} from './outcome';
import type { TicketCode } from './parseTicketCode';

export type EnqueueResult = 'queued' | 'inFlight' | 'replayed' | 'cooldown';

export type ScanQueueDeps = {
  submit: (code: TicketCode) => Promise<ScanResponse>;
  onResult: (code: TicketCode, outcome: ScanOutcome) => void;
  now: () => number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  concurrency?: number;
  maxRetries?: number;
  cooldownMs?: number;
  maxSettled?: number;
};

// Port of web lib/scan/queue.js: queue, don't drop; de-dupe on the code; replay settled codes.
// Differences: the queue (not the API client) owns retries because the scan POST is not
// idempotent, and it tracks when an attempt may have committed (see classify's uncertainSince).
export function createScanQueue(deps: ScanQueueDeps) {
  const concurrency = deps.concurrency ?? 3;
  const maxRetries = deps.maxRetries ?? 2;
  const cooldownMs = deps.cooldownMs ?? 2_000;
  const maxSettled = deps.maxSettled ?? 5_000;

  let generation = 0;
  let active = 0;
  const waiting: TicketCode[] = [];
  const pending = new Set<TicketCode>();
  const settled = new Map<TicketCode, ScanOutcome>();
  const uncertain = new Map<TicketCode, number>();
  const cooldownUntil = new Map<TicketCode, number>();

  function emit(code: TicketCode, outcome: ScanOutcome) {
    try {
      deps.onResult(code, outcome);
    } catch {
      // A throwing consumer must not stall the door.
    }
  }

  function startCooldown(code: TicketCode) {
    const now = deps.now();
    cooldownUntil.set(code, now + cooldownMs);
    if (cooldownUntil.size > 1_000) {
      for (const [k, until] of cooldownUntil) if (until <= now) cooldownUntil.delete(k);
    }
  }

  function remember(code: TicketCode, outcome: ScanOutcome) {
    settled.delete(code);
    settled.set(code, outcome);
    if (settled.size > maxSettled) {
      const oldest = settled.keys().next();
      if (!oldest.done) settled.delete(oldest.value);
    }
  }

  async function submitSafely(code: TicketCode): Promise<ScanResponse> {
    try {
      return await deps.submit(code);
    } catch {
      return err({ kind: 'network' });
    }
  }

  async function run(
    code: TicketCode,
  ): Promise<{ outcome: ScanOutcome; uncertainSince: number | null }> {
    let uncertainSince = uncertain.get(code) ?? null;
    for (let attempt = 0; ; attempt++) {
      const startedAt = deps.now();
      const res = await submitSafely(code);
      const outcome = classify(res, { uncertainSince });
      if (mayHaveCommitted(res)) uncertainSince ??= startedAt;
      if (!isTransient(res) || attempt >= maxRetries) return { outcome, uncertainSince };
      await deps.sleep(400 * (attempt + 1) + Math.floor(deps.random() * 200));
    }
  }

  function drain() {
    while (active < concurrency) {
      const code = waiting.shift();
      if (code === undefined) return;
      active += 1;
      const gen = generation;
      void run(code).then(({ outcome, uncertainSince }) => {
        if (gen !== generation) return;
        active -= 1;
        pending.delete(code);
        if (outcome.kind === 'admitted' || outcome.kind === 'used') {
          remember(code, outcome);
          uncertain.delete(code);
        } else if (outcome.kind === 'couldntCheck' && uncertainSince !== null) {
          uncertain.set(code, uncertainSince);
        }
        startCooldown(code);
        emit(code, outcome);
        drain();
      });
    }
  }

  return {
    enqueue(code: TicketCode, opts: { manual?: boolean } = {}): EnqueueResult {
      if (pending.has(code)) return 'inFlight';
      const until = cooldownUntil.get(code);
      if (opts.manual !== true && until !== undefined && deps.now() < until) return 'cooldown';
      const s = settled.get(code);
      if (s) {
        startCooldown(code);
        emit(code, replayOf(s));
        return 'replayed';
      }
      pending.add(code);
      waiting.push(code);
      drain();
      return 'queued';
    },
    pendingCount: () => pending.size,
    reset() {
      generation += 1;
      active = 0;
      waiting.length = 0;
      pending.clear();
      settled.clear();
      uncertain.clear();
      cooldownUntil.clear();
    },
  };
}

export type ScanQueue = ReturnType<typeof createScanQueue>;
