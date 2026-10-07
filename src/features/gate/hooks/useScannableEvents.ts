import { useQuery } from '@tanstack/react-query';
import { useCallback } from 'react';

import { gateKeys } from '@/features/gate/api/keys';
import { loadScannableEvents, type ScannableEvent } from '@/shared/api/scannableEvents';
import type { ApiError } from '@/shared/lib/errors';
import { scannerDb } from '@/shared/supabase/scannerDb';

type State =
  { status: 'loading' } | { status: 'error' } | { status: 'ready'; events: ScannableEvent[] };

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
class EventsError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`events load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

export function useScannableEvents(userId: string | null): {
  state: State;
  refreshing: boolean;
  /** Resolves to the fresh list, or null when the refetch failed. */
  refresh: () => Promise<ScannableEvent[] | null>;
} {
  const q = useQuery({
    queryKey: gateKeys.events(userId ?? ''),
    enabled: userId !== null,
    queryFn: async () => {
      const r = await loadScannableEvents(scannerDb, userId ?? '');
      if (!r.ok) throw new EventsError(r.error);
      return r.value;
    },
  });
  const { refetch } = q;
  // Stable: the scanner route runs an effect keyed on it.
  const refresh = useCallback(async () => {
    const r = await refetch();
    return r.isError ? null : (r.data ?? null);
  }, [refetch]);
  let state: State = { status: 'loading' };
  if (q.data !== undefined) state = { status: 'ready', events: q.data };
  else if (q.isError) state = { status: 'error' };
  return {
    state,
    refreshing: q.isRefetching,
    refresh,
  };
}
