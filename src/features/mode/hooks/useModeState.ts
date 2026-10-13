import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { loadModeInputs, type ModeDb } from '@/features/mode/api/loadModeInputs';
import { modeCache } from '@/features/mode/api/modeCache';
import { withCachedMode } from '@/features/mode/domain/modeCache';
import { useChosenMode } from '@/features/mode/hooks/useChosenMode';
import { resolveMode, type Mode } from '@/features/mode/domain/resolveMode';
import type { ModeState } from '@/features/mode/domain/route';
import { loadScannableEvents } from '@/shared/api/scannableEvents';
import { isRetryable, type ApiError } from '@/shared/lib/errors';
import { supabase } from '@/shared/supabase/client';
import { scannerDb } from '@/shared/supabase/scannerDb';
import { wrap } from '@/shared/supabase/wrap';

const db: ModeDb = {
  profile: (id) =>
    wrap(supabase.from('users').select('id,role,name,email').eq('id', id).maybeSingle()),
  hotelStaff: (id) =>
    wrap(supabase.from('hotel_staff').select('hotel_id').eq('user_id', id).limit(1)),
  scannableEvents: (id) => loadScannableEvents(scannerDb, id),
};

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
class ModeLoadError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`mode load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

export function useModeState(userId: string | null): {
  state: ModeState;
  chosen: Mode | null;
  choose: (m: Mode) => void;
  retry: () => void;
} {
  const chosen = useChosenMode((s) => s.chosen);
  const loaded = useChosenMode((s) => s.loaded && s.userId === userId);
  const load = useChosenMode((s) => s.load);
  const chooseFor = useChosenMode((s) => s.choose);

  useEffect(() => {
    if (userId !== null) void load(userId);
  }, [userId, load]);

  const q = useQuery({
    queryKey: ['mode', userId],
    enabled: userId !== null,
    queryFn: async () => {
      const r = await loadModeInputs(db, userId ?? '');
      if (!r.ok) throw new ModeLoadError(r.error);
      return r.value;
    },
  });

  // The last good resolution on disk: an offline cold start must still reach saved data (A1).
  const cache = useQuery({
    queryKey: ['modeCache', userId],
    enabled: userId !== null,
    networkMode: 'always',
    staleTime: Infinity,
    retry: false,
    queryFn: () => modeCache.load(userId ?? ''),
  });

  const queryClient = useQueryClient();
  const data = q.data;
  useEffect(() => {
    if (userId === null || data === undefined) return;
    const r = resolveMode(data);
    queryClient.setQueryData(['modeCache', userId], r.kind === 'modes' ? r : null);
    void modeCache.save(userId, r).catch(() => undefined);
  }, [userId, data, queryClient]);

  let state: ModeState = { status: 'idle' };
  if (userId !== null) {
    if (q.isPending || !loaded) state = { status: 'loading' };
    else if (q.isError) state = { status: 'error' };
    else state = { status: 'ready', resolution: resolveMode(q.data, chosen) };
    if (loaded) {
      const failure = q.isError ? q.error : q.failureReason;
      state = withCachedMode(
        state,
        {
          offline: q.isPending && q.fetchStatus === 'paused',
          transientError: failure instanceof ModeLoadError && isRetryable(failure.apiError),
        },
        cache.data ?? null,
        chosen,
      );
    }
  }

  return {
    state,
    chosen,
    choose: (m) => {
      if (userId !== null) chooseFor(userId, m);
    },
    retry: () => {
      void q.refetch();
    },
  };
}
