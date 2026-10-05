import { useQuery } from '@tanstack/react-query';

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
  refresh: () => void;
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
  let state: State = { status: 'loading' };
  if (q.data !== undefined) state = { status: 'ready', events: q.data };
  else if (q.isError) state = { status: 'error' };
  return {
    state,
    refreshing: q.isRefetching,
    refresh: () => {
      void q.refetch();
    },
  };
}
