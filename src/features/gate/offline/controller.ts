import { listExpiry } from '@/features/gate/domain/listExpiry';
import type { ScanOutcome } from '@/features/gate/domain/outcome';
import type { TicketCode } from '@/features/gate/domain/parseTicketCode';
import type { SyncStatus } from '@/features/gate/domain/syncLine';
import type { ClockState } from '@/shared/lib/clockGuard';
import type { Connectivity } from '@/shared/lib/connectivity';

import { syncOutbox, type PostBatch } from './batchSync';
import type { GateDb } from './gateDb';
import { createOfflineGate, type OfflineGate } from './offlineGate';
import type { AttentionItem } from './outboxStore';
import { refreshKeys, syncRoster, type FetchRosterPage } from './rosterSync';
import type { SyncKind } from './rosterStore';

export type ControllerDeps = {
  eventId: string;
  db: () => Promise<GateDb>;
  fetchPage: FetchRosterPage;
  post: PostBatch;
  serverNow: () => number;
  clockState: () => ClockState;
  connectivity: Pick<Connectivity, 'isDegraded' | 'subscribe'>;
  /** Event start from the scannable list, read when a sync finishes. */
  endsAt: () => number | null;
  appVersion: string;
  random: () => number;
  publish: (s: Partial<SyncStatus>) => void;
  report: (e: unknown) => void;
};

export const DELTA_EVERY_MS = 3 * 60_000;
export const FULL_EVERY_MS = 30 * 60_000;
const TICK_MS = 30_000;
const STATUS_MS = 15_000;
const KEYS_GAP_MS = 60_000;

// Foreground only (spec decision 4): started while the scanner is focused, stopped otherwise.
export function createOfflineController(deps: ControllerDeps) {
  const { eventId } = deps;
  let running = false;
  let listBusy = false;
  let outboxBusy = false;
  let lastKeysAt = -Infinity;
  let timers: ReturnType<typeof setInterval>[] = [];
  let unsubscribe: (() => void) | null = null;
  let gatePromise: Promise<OfflineGate> | null = null;

  const fail = (e: unknown) => {
    deps.report(e);
  };

  function gate(): Promise<OfflineGate> {
    gatePromise ??= deps.db().then((d) =>
      createOfflineGate({
        eventId,
        roster: d.roster,
        outbox: d.outbox,
        serverNow: deps.serverNow,
        clockState: deps.clockState,
        appVersion: deps.appVersion,
        onKeysOutdated: () => {
          keysOutdated();
        },
        onAdmitted: () => {
          void refreshStatus();
        },
      }),
    );
    return gatePromise;
  }

  async function refreshStatus(): Promise<void> {
    try {
      const d = await deps.db();
      const meta = await d.roster.meta(eventId);
      const counts = await d.roster.counts(eventId);
      const s = await d.outbox.status(eventId);
      deps.publish({
        mode: deps.connectivity.isDegraded() ? 'offline' : 'online',
        list: meta?.ready === true ? { count: counts.total, syncedAt: meta.syncedAt ?? 0 } : null,
        localCounts: meta?.ready === true ? counts : null,
        pending: s.pending,
        attention: s.attention,
        blocked: s.blocked,
        clock: deps.clockState(),
      });
    } catch (e) {
      fail(e);
    }
  }

  async function syncList(kind: SyncKind): Promise<void> {
    if (listBusy) return;
    listBusy = true;
    try {
      const d = await deps.db();
      const r = await syncRoster(
        {
          store: d.roster,
          fetchPage: deps.fetchPage,
          eventId,
          onProgress: (p) => {
            deps.publish({ download: p });
          },
        },
        kind,
      );
      if (r.ok) {
        const meta = await d.roster.meta(eventId);
        const ends = deps.endsAt() ?? listExpiry(meta?.eventDate ?? null);
        if (ends !== null) await d.roster.setEndsAt(eventId, ends);
      }
    } catch (e) {
      fail(e);
    } finally {
      listBusy = false;
      deps.publish({ download: null });
      await refreshStatus();
    }
  }

  async function syncPending(): Promise<void> {
    if (outboxBusy) return;
    outboxBusy = true;
    deps.publish({ syncing: true });
    try {
      const d = await deps.db();
      await syncOutbox({
        store: d.outbox,
        eventId,
        post: deps.post,
        now: () => Date.now(),
        random: deps.random,
        report: deps.report,
      });
    } catch (e) {
      fail(e);
    } finally {
      outboxBusy = false;
      deps.publish({ syncing: false });
      await refreshStatus();
    }
  }

  // Every 30 s: send what is due, then bring the list up to date (full every 30 min).
  async function tick(): Promise<void> {
    if (deps.connectivity.isDegraded()) {
      await refreshStatus();
      return;
    }
    await syncPending();
    try {
      const meta = await (await deps.db()).roster.meta(eventId);
      const now = deps.serverNow();
      if (meta?.ready !== true || now - (meta.fullAt ?? 0) > FULL_EVERY_MS) await syncList('full');
      else if (now - (meta.syncedAt ?? 0) > DELTA_EVERY_MS) await syncList('delta');
    } catch (e) {
      fail(e);
    }
  }

  function keysOutdated(): void {
    const now = Date.now();
    if (now - lastKeysAt < KEYS_GAP_MS) return;
    lastKeysAt = now;
    void (async () => {
      try {
        const d = await deps.db();
        await refreshKeys({ store: d.roster, fetchPage: deps.fetchPage, eventId });
      } catch (e) {
        fail(e);
      }
    })();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      void tick();
      timers = [
        setInterval(() => void tick(), TICK_MS),
        setInterval(() => void refreshStatus(), STATUS_MS),
      ];
      unsubscribe = deps.connectivity.subscribe((degraded) => {
        deps.publish({ mode: degraded ? 'offline' : 'online' });
        if (!degraded) void tick();
      });
    },
    stop(): void {
      running = false;
      for (const t of timers) clearInterval(t);
      timers = [];
      unsubscribe?.();
      unsubscribe = null;
    },
    decide: async (code: TicketCode): Promise<ScanOutcome> => (await gate()).decide(code),
    noteLive: (code: TicketCode, outcome: ScanOutcome): void => {
      void gate()
        .then((g) => g.noteLive(code, outcome))
        .catch(fail);
    },
    keysOutdated,
    refreshList: (): void => {
      void syncList('full');
    },
    syncNow: (): void => {
      void syncPending();
    },
    attention: async (): Promise<AttentionItem[]> => (await deps.db()).outbox.attention(eventId),
    dropList: async (): Promise<void> => {
      await (await deps.db()).roster.drop(eventId);
    },
  };
}

export type OfflineController = ReturnType<typeof createOfflineController>;
