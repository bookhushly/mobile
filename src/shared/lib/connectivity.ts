type Listener = (degraded: boolean) => void;

// Spec §2.2: two consecutive transient failures (or the OS reporting no network) mean
// "degraded": scans decide on the phone at once. Only a real server answer leaves it.
export function createConnectivity(opts: { failuresToDegrade?: number } = {}) {
  const limit = opts.failuresToDegrade ?? 2;
  let failures = 0;
  let degraded = false;
  const listeners = new Set<Listener>();

  function set(next: boolean) {
    if (next === degraded) return;
    degraded = next;
    for (const l of listeners) {
      try {
        l(next);
      } catch {
        // A failing listener must not stop the others.
      }
    }
  }

  return {
    /** The server answered (any status below 500, 429 included). */
    reached(): void {
      failures = 0;
      set(false);
    },
    /** Network error, timeout or 5xx. */
    unreachable(): void {
      failures += 1;
      if (failures >= limit) set(true);
    },
    networkLost(): void {
      set(true);
    },
    isDegraded: (): boolean => degraded,
    subscribe(l: Listener): () => void {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
  };
}

export type Connectivity = ReturnType<typeof createConnectivity>;
