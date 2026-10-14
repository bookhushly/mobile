import { useCallback, useEffect, useState } from 'react';

import { plainKv } from '@/shared/platform/storage';

export const WEB_NOTE_KEY = 'bh.listing.webNote';
const SEEN = '1';

// Spec D11, final UX review U1: a one-time note on the first hand-off to bookhushly.com.
// Device-wide (no PII). `show` (still due) is false until the store answers, and a failed read
// hides it: a note never blocks booking.
export function useWebNote(): { show: boolean; markSeen: () => void } {
  const [show, setShow] = useState(false);
  useEffect(() => {
    let live = true;
    plainKv
      .get(WEB_NOTE_KEY)
      .then((v) => {
        if (live) setShow(v !== SEEN);
      })
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, []);
  const markSeen = useCallback(() => {
    setShow(false);
    plainKv.set(WEB_NOTE_KEY, SEEN).catch(() => undefined);
  }, []);
  return { show, markSeen };
}
