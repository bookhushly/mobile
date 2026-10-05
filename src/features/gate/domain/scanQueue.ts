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
  // Server clock: only for uncertainSince, which is compared with the server's checked_in_at.
  now: () => number;
  // Monotonic local clock: cooldowns must not move when the server offset is re-derived.
  localNow: () => number;
  random: () => number;
  sleep: (ms: number) => Promise<void>;
  concurrency?: number;
  // Retries for network/429/5xx. A timeout already cost a full timeout, so it gets fewer.
  maxRetries?: number;
  maxTimeoutRetries?: number;
  cooldownMs?: number;
  maxSettled?: number;
};

// Port of web lib/scan/queue.js: queue, don't drop; de-dupe on the code; replay settled codes.
// Differences: the queue (not the API client) owns retries because the scan POST is not
// idempotent, and it tracks when an attempt may have committed (see classify's uncertainSince).
export function createScanQueue(deps: ScanQueueDeps) {
  const concurrency = deps.concurrency ?? 3;
  const maxRetries = deps.maxRetries ?? 2;
  const maxTimeoutRetries = deps.maxTimeoutRetries ?? 1;
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

  // Sliding: every camera sighting pushes the end forward, so a code held in view stays one presentation.
  function startCooldown(code: TicketCode) {
    const now = deps.localNow();
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

  type RunResult = { outcome: ScanOutcome; uncertainSince: number | null };

  // Resolves null when a reset happened mid-run: a stale run must not submit again.
  async function run(code: TicketCode, gen: number): Promise<RunResult | null> {
    let uncertainSince = uncertain.get(code) ?? null;
    let timeouts = 0;
    for (let attempt = 0; ; attempt++) {
      if (gen !== generation) return null;
      const startedAt = deps.now();
      const res = await submitSafely(code);
      const outcome = classify(res, { uncertainSince });
      if (mayHaveCommitted(res)) uncertainSince ??= startedAt;
      if (!res.ok && res.error.kind === 'timeout') timeouts += 1;
      const retry = isTransient(res) && attempt < maxRetries && timeouts <= maxTimeoutRetries;
      if (!retry) return { outcome, uncertainSince };
      await deps.sleep(400 * (attempt + 1) + Math.floor(deps.random() * 200));
      if (gen !== generation) return null;
    }
  }

  function drain() {
    while (active < concurrency) {
      const code = waiting.shift();
      if (code === undefined) return;
      active += 1;
      const gen = generation;
      const failed: RunResult = {
        outcome: { kind: 'couldntCheck', cause: 'network' },
        uncertainSince: uncertain.get(code) ?? null,
      };
      void run(code, gen)
        .catch(() => failed)
        .then((result) => {
          if (result === null || gen !== generation) return;
          const { outcome, uncertainSince } = result;
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
      if (opts.manual !== true && until !== undefined && deps.localNow() < until) {
        startCooldown(code);
        return 'cooldown';
      }
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
    /** A camera sighting that is otherwise ignored (the code is on screen): keep its cooldown sliding. */
    touch(code: TicketCode) {
      startCooldown(code);
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
