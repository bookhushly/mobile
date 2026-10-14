import { useIsFocused } from 'expo-router';
import { useEffect, useRef } from 'react';

import type { Saved } from '@/features/customer/hooks/useSaved';
import { useScreenReader } from '@/shared/platform/useScreenReader';

/** The Undo and "Couldn't save" banners go after this long… */
export const NOTICE_MS = 8_000;
/** …or this long while a screen reader is on (time to reach and read it). */
export const NOTICE_READER_MS = 20_000;

// Review 5 (1): the hearts' Undo and transient-error banners don't stay for the session. They go
// after a while, and when the screen loses focus. The stale-session banner stays until the
// customer acts (Sign in again, a later write that works, or pull to refresh).
export function useSavedNotices(saved: Saved): void {
  const focused = useIsFocused();
  const reader = useScreenReader();
  // The latest hook result, so a timer started for one banner calls the current functions.
  const latest = useRef(saved);
  useEffect(() => {
    latest.current = saved;
  });
  const ms = reader ? NOTICE_READER_MS : NOTICE_MS;
  const { lastRemoved } = saved;
  const transient = saved.writeError === 'transient';

  useEffect(() => {
    if (lastRemoved === null) return;
    if (!focused) {
      latest.current.dismissUndo();
      return;
    }
    const t = setTimeout(() => {
      latest.current.dismissUndo();
    }, ms);
    return () => {
      clearTimeout(t);
    };
  }, [lastRemoved, focused, ms]);

  useEffect(() => {
    if (!transient) return;
    if (!focused) {
      latest.current.clearWriteError();
      return;
    }
    const t = setTimeout(() => {
      latest.current.clearWriteError();
    }, ms);
    return () => {
      clearTimeout(t);
    };
  }, [transient, focused, ms]);
}
