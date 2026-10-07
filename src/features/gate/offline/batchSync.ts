import type { BatchItem } from '@/features/gate/api/batch';
import { backoffMs, reconcile } from '@/features/gate/domain/syncReconcile';
import { batchResults, type BatchBody } from '@/features/gate/schemas/batch';
import { isRetryable, type ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

import type { OutboxItem, OutboxState, OutboxStore } from './outboxStore';

export type PostBatch = (deviceId: string, items: BatchItem[]) => Promise<Result<BatchBody, ApiError>>;
export type BatchSyncOutcome = 'idle' | 'retryLater' | 'blocked' | 'error';

type Deps = {
  store: OutboxStore;
  eventId: string;
  post: PostBatch;
  /** Local wall clock: next_try_at is compared with it. */
  now: () => number;
  random: () => number;
  report: (e: unknown) => void;
  batchSize?: number;
};

const toBatchItem = (i: OutboxItem): BatchItem => ({
  client_seq: i.seq,
  ticket_id: i.code,
  scanned_at: i.scannedAt,
  mode: i.mode,
});

// auth: the client already refreshed once; validation: a 200 we couldn't read may have committed,
// and resending is safe because the endpoint is idempotent.
const keepAndRetry = (e: ApiError) =>
  isRetryable(e) || e.kind === 'auth' || e.kind === 'aborted' || e.kind === 'validation';

export async function syncOutbox(deps: Deps): Promise<BatchSyncOutcome> {
  const size = deps.batchSize ?? 200;
  for (;;) {
    const items = await deps.store.due(deps.eventId, deps.now(), size);
    if (items.length === 0) return 'idle';
    const seqs = items.map((i) => i.seq);
    const later = () => deps.now() + backoffMs(Math.max(...items.map((i) => i.attempts)), deps.random);
    // Fetch the device id first: a failure here must not strand the items in 'sending'.
    const deviceId = await deps.store.deviceId();
    await deps.store.markSending(seqs);
    try {
      const outcome = await sendAndSettle(deps, deviceId, items, seqs, later);
      if (outcome !== null) return outcome;
    } catch (e) {
      // The items are 'sending'; put them back so they go again (the endpoint is idempotent).
      deps.report(e);
      await deps.store.retryLater(seqs, later());
      return 'retryLater';
    }
  }
}

/** Posts one batch and settles it; null means "carry on with the next batch". */
async function sendAndSettle(
  deps: Deps,
  deviceId: string,
  items: OutboxItem[],
  seqs: number[],
  later: () => number,
): Promise<BatchSyncOutcome | null> {
  const res = await deps.post(deviceId, items.map(toBatchItem));
  if (!res.ok) {
    const e = res.error;
    if (e.kind === 'forbidden') {
      await deps.store.blockEvent(deps.eventId);
      return 'blocked';
    }
    if (keepAndRetry(e)) {
      await deps.store.retryLater(seqs, later());
      return 'retryLater';
    }
    // A 400/404 is our bug (bad request shape or event id): park the items, report, don't loop.
    await deps.store.settle(seqs.map((seq) => ({ seq, state: 'error', result: { kind: e.kind } })));
    deps.report(new Error(`batch sync failed: ${e.kind}`));
    return 'error';
  }
  const bySeq = new Map(batchResults(res.value).map((r) => [r.client_seq, r] as const));
  const settled: { seq: number; state: OutboxState; result: Record<string, unknown> }[] = [];
  const missing: number[] = [];
  for (const i of items) {
    const r = bySeq.get(i.seq);
    if (r === undefined) missing.push(i.seq);
    else settled.push({ seq: i.seq, ...reconcile(r) });
  }
  await deps.store.settle(settled);
  if (missing.length > 0) {
    await deps.store.retryLater(missing, later());
    return 'retryLater';
  }
  return null;
}
