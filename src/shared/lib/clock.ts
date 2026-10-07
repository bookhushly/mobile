import type { KeyValue } from './kv';

const KEY = 'bh.clock.offset';
const MAX_ABS_OFFSET_MS = 24 * 60 * 60 * 1000;

type Saved = { o: number; c: number };
const isSaved = (v: unknown): v is Saved =>
  typeof v === 'object' &&
  v !== null &&
  'o' in v &&
  typeof v.o === 'number' &&
  'c' in v &&
  typeof v.c === 'number';

export function createClock(deps: { storage: KeyValue; now: () => number }) {
  let offset = 0;
  // Server time of the last Date header we trusted: the clock guard compares against it.
  let lastContact: number | null = null;
  return {
    async load(): Promise<void> {
      const raw = await deps.storage.get(KEY);
      if (raw === null) return;
      const legacy = Number(raw);
      if (Number.isFinite(legacy)) {
        offset = legacy;
        return;
      }
      try {
        const v: unknown = JSON.parse(raw);
        if (isSaved(v)) {
          offset = v.o;
          lastContact = v.c;
        }
      } catch {
        // Unreadable: keep the defaults.
      }
    },
    // Synchronous in memory; persisted in the background so a slow or failing storage write is
    // never on the request path.
    recordServerDate(header: string | null): void {
      if (header === null) return;
      const server = Date.parse(header);
      if (!Number.isFinite(server)) return;
      const next = server - deps.now();
      if (Math.abs(next) > MAX_ABS_OFFSET_MS) return;
      offset = next;
      lastContact = server;
      void deps.storage.set(KEY, JSON.stringify({ o: next, c: server })).catch(() => undefined);
    },
    offsetMs: () => offset,
    serverNow: () => deps.now() + offset,
    lastContactMs: () => lastContact,
  };
}

export type Clock = ReturnType<typeof createClock>;
