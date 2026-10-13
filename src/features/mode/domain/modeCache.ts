import type { KeyValue } from '@/shared/lib/kv';

import { parseMode, type Mode, type ModeResolution } from './resolveMode';
import type { ModeState } from './route';

type ModesResolution = Extract<ModeResolution, { kind: 'modes' }>;

const PREFIX = 'bh.mode.last.';
// The users with a cached resolution, so a sign-out wipe (which has no user id) finds them all.
const INDEX_KEY = 'bh.mode.lastUsers';

const key = (userId: string) => `${PREFIX}${userId}`;

function parseJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function parseResolution(raw: string | null): ModesResolution | null {
  if (raw === null) return null;
  const v = parseJson(raw);
  if (typeof v !== 'object' || v === null || !('modes' in v) || !('defaultMode' in v)) return null;
  if (!Array.isArray(v.modes) || v.modes.length === 0) return null;
  const modes: Mode[] = [];
  for (const m of v.modes) {
    const p = typeof m === 'string' ? parseMode(m) : null;
    if (p === null) return null;
    modes.push(p);
  }
  const defaultMode = typeof v.defaultMode === 'string' ? parseMode(v.defaultMode) : null;
  if (defaultMode === null || !modes.includes(defaultMode)) return null;
  return { kind: 'modes', modes, defaultMode };
}

function parseIndex(raw: string | null): string[] {
  const v = raw === null ? null : parseJson(raw);
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];
}

/**
 * The last good mode resolution per user (role-derived only: modes + default, no PII), so a
 * cold start offline still reaches the user's saved data. Mode is not authority: the server
 * decides every action, so a stale cache can only show a screen, never grant anything.
 */
export function createModeCache(kv: KeyValue) {
  // Saves and wipes run one at a time, in call order (the index is read-modify-write).
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (op: () => Promise<void>): Promise<void> => {
    const run = queue.then(op);
    queue = run.catch(() => undefined);
    return run;
  };
  return {
    async load(userId: string): Promise<ModesResolution | null> {
      try {
        return parseResolution(await kv.get(key(userId)));
      } catch {
        return null;
      }
    },
    save(userId: string, r: ModeResolution): Promise<void> {
      return enqueue(async () => {
        if (r.kind === 'webOnly') {
          await kv.delete(key(userId));
          return;
        }
        const index = parseIndex(await kv.get(INDEX_KEY));
        if (!index.includes(userId)) await kv.set(INDEX_KEY, JSON.stringify([...index, userId]));
        await kv.set(key(userId), JSON.stringify({ modes: r.modes, defaultMode: r.defaultMode }));
      });
    },
    wipe(): Promise<void> {
      return enqueue(async () => {
        const index = parseIndex(await kv.get(INDEX_KEY));
        for (const u of index) await kv.delete(key(u));
        await kv.delete(INDEX_KEY);
      });
    },
  };
}

export type QueryHealth = {
  /** No data and the fetch is paused because the device is offline. */
  offline: boolean;
  /** The lookup failed (or is retrying) with network/timeout/unavailable/rateLimited. */
  transientError: boolean;
};

/**
 * Falls back to the cached resolution only when the live lookup is offline or transiently
 * failing. A real refusal (auth/forbidden/validation/not found) still shows the error.
 */
export function withCachedMode(
  state: ModeState,
  health: QueryHealth,
  cached: ModesResolution | null,
  chosen: Mode | null,
): ModeState {
  if (cached === null) return state;
  if (state.status !== 'loading' && state.status !== 'error') return state;
  const usable =
    state.status === 'loading' ? health.offline || health.transientError : health.transientError;
  if (!usable) return state;
  const defaultMode =
    chosen !== null && cached.modes.includes(chosen) ? chosen : cached.defaultMode;
  return { status: 'ready', resolution: { ...cached, defaultMode } };
}
