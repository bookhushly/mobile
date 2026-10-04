import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

import { loadModeInputs, type ModeDb } from '@/features/mode/api/loadModeInputs';
import { resolveMode, type Mode } from '@/features/mode/domain/resolveMode';
import type { ModeState } from '@/features/mode/domain/route';
import type { ApiError } from '@/shared/lib/errors';
import { plainKv } from '@/shared/platform/storage';
import { supabase } from '@/shared/supabase/client';

type Builder = PromiseLike<{
  data: unknown;
  error: { code?: string } | null;
  status: number;
}>;

const wrap = async (b: Builder) => {
  const r = await b;
  return {
    data: r.data,
    error: r.error ? { code: r.error.code, status: r.status } : null,
  };
};

const db: ModeDb = {
  profile: (id) =>
    wrap(supabase.from('users').select('id,role,name,email').eq('id', id).maybeSingle()),
  hotelStaff: (id) =>
    wrap(supabase.from('hotel_staff').select('hotel_id').eq('user_id', id).maybeSingle()),
  activeScanners: (id) =>
    wrap(supabase.from('event_scanners').select('id').eq('user_id', id).eq('is_active', true)),
};

const LAST_MODE = 'bh.lastMode';

// Carries the typed ApiError (has `kind`) so the query retry policy can classify it.
class ModeLoadError extends Error {
  readonly kind: ApiError['kind'];
  constructor(readonly apiError: ApiError) {
    super(`mode load failed: ${apiError.kind}`);
    this.kind = apiError.kind;
  }
}

function asMode(v: string | null): Mode | null {
  return v === 'customer' || v === 'gate' || v === 'receptionist' ? v : null;
}

export function useModeState(userId: string | null): {
  state: ModeState;
  chosen: Mode | null;
  choose: (m: Mode) => void;
  retry: () => void;
} {
  const [chosen, setChosen] = useState<Mode | null>(null);

  useEffect(() => {
    void plainKv.get(LAST_MODE).then((v) => {
      setChosen(asMode(v));
    });
  }, []);

  const q = useQuery({
    queryKey: ['mode', userId],
    enabled: userId !== null,
    queryFn: async () => {
      const r = await loadModeInputs(db, userId ?? '');
      if (!r.ok) throw new ModeLoadError(r.error);
      return r.value;
    },
  });

  let state: ModeState = { status: 'idle' };
  if (userId !== null) {
    if (q.isPending) state = { status: 'loading' };
    else if (q.isError) state = { status: 'error' };
    else state = { status: 'ready', resolution: resolveMode(q.data, chosen) };
  }

  return {
    state,
    chosen,
    choose: (m) => {
      setChosen(m);
      void plainKv.set(LAST_MODE, m);
    },
    retry: () => {
      void q.refetch();
    },
  };
}
