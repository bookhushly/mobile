import type { RosterPage } from '@/features/gate/schemas/roster';
import { toRosterRows } from '@/features/gate/schemas/roster';
import type { ApiError } from '@/shared/lib/errors';
import type { Result } from '@/shared/lib/result';

import type { RosterStore, SyncKind } from './rosterStore';

export type FetchRosterPage = (p: {
  cursor: string | null;
  since: string | null;
  limit: number;
}) => Promise<Result<RosterPage, ApiError>>;
export type RosterSyncResult = { ok: true; kind: SyncKind } | { ok: false; error: ApiError };

type Deps = {
  store: RosterStore;
  fetchPage: FetchRosterPage;
  eventId: string;
  onProgress?: (p: { done: number; total: number }) => void;
  pageSize?: number;
};

const infoOf = (p: RosterPage) => ({
  title: p.event.title,
  eventDate: p.event.event_date,
  requireDynamic: p.event.require_dynamic_ticket,
  total: p.event.total,
});
// keys_error: the server's key config is broken; keep the keys we have rather than erase them.
const keysOf = (p: RosterPage) =>
  p.keys === undefined || p.keys_error === true
    ? null
    : p.keys.map((k) => ({ kid: k.kid, publicKey: k.publicKey }));

// Spec §3: pages of ≤ 2000, one transaction per page with its cursor, resumable. A full sync is
// staged and swapped in at the end; a delta merges into the live list.
export async function syncRoster(deps: Deps, requested: SyncKind): Promise<RosterSyncResult> {
  const { store, eventId } = deps;
  const meta = await store.meta(eventId);
  const interruptedFull = meta?.syncKind === 'full' && meta.cursor !== null;
  const kind: SyncKind =
    !interruptedFull && requested === 'delta' && meta?.ready === true && meta.sinceMark !== null
      ? 'delta'
      : 'full';
  let cursor = meta?.syncKind === kind ? meta.cursor : null;
  const since = kind === 'delta' ? (meta?.sinceMark ?? null) : null;
  let done = 0;
  for (;;) {
    const r = await deps.fetchPage({ cursor, since, limit: deps.pageSize ?? 2000 });
    if (!r.ok) return { ok: false, error: r.error };
    const page = r.value;
    if (cursor === null) await store.beginSync(eventId, kind, page.server_time, infoOf(page), keysOf(page));
    const { rows } = toRosterRows(page.tickets);
    await store.writePage(eventId, kind, rows, page.next_after);
    done += rows.length;
    deps.onProgress?.({ done, total: page.event.total });
    if (page.next_after === null) {
      await store.finishSync(eventId, kind);
      return { ok: true, kind };
    }
    cursor = page.next_after;
  }
}

/** Spec §4 rule 3: one small request refreshes the key set when a code names an unknown kid. */
export async function refreshKeys(deps: Omit<Deps, 'onProgress' | 'pageSize'>): Promise<boolean> {
  const r = await deps.fetchPage({ cursor: null, since: null, limit: 1 });
  if (!r.ok) return false;
  const keys = keysOf(r.value);
  if (keys === null) return false;
  await deps.store.setKeys(deps.eventId, keys);
  return true;
}
