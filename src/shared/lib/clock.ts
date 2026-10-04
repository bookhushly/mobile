import type { KeyValue } from './kv';

const KEY = 'bh.clock.offset';
const MAX_ABS_OFFSET_MS = 24 * 60 * 60 * 1000;

export function createClock(deps: { storage: KeyValue; now: () => number }) {
  let offset = 0;
  return {
    async load(): Promise<void> {
      const raw = await deps.storage.get(KEY);
      const n = raw === null ? NaN : Number(raw);
      if (Number.isFinite(n)) offset = n;
    },
    async recordServerDate(header: string | null): Promise<void> {
      if (header === null) return;
      const server = Date.parse(header);
      if (!Number.isFinite(server)) return;
      const next = server - deps.now();
      if (Math.abs(next) > MAX_ABS_OFFSET_MS) return;
      offset = next;
      await deps.storage.set(KEY, String(next));
    },
    offsetMs: () => offset,
    serverNow: () => deps.now() + offset,
  };
}

export type Clock = ReturnType<typeof createClock>;
