import { useCallback, useEffect, useState } from 'react';

import { plainKv } from '@/shared/platform/storage';

const key = (userId: string) => `bh.gate.lastEvent.${userId}`;

export function useLastEvent(userId: string | null): {
  lastEventId: string | null;
  loaded: boolean;
  remember: (id: string) => void;
  forget: () => void;
} {
  const [state, setState] = useState<{ id: string | null; loaded: boolean }>({
    id: null,
    loaded: false,
  });
  useEffect(() => {
    if (userId === null) return;
    let live = true;
    void plainKv
      .get(key(userId))
      .catch(() => null)
      .then((id) => {
        if (live) setState({ id, loaded: true });
      });
    return () => {
      live = false;
    };
  }, [userId]);
  const remember = useCallback(
    (id: string) => {
      if (userId !== null) void plainKv.set(key(userId), id).catch(() => undefined);
    },
    [userId],
  );
  const forget = useCallback(() => {
    setState((s) => ({ ...s, id: null }));
    if (userId !== null) void plainKv.delete(key(userId)).catch(() => undefined);
  }, [userId]);
  return { lastEventId: state.id, loaded: state.loaded, remember, forget };
}
