import { useEffect, useState } from 'react';

import { clock } from '@/shared/api/instance';

// The server clock, re-read every second while `active` (R17 countdowns). It re-syncs the moment
// `active` turns on (adjusting state during render, not in an effect) so the first second is right.
export function useTicking(active: boolean): number {
  const [now, setNow] = useState(() => clock.serverNow());
  const [was, setWas] = useState(active);
  if (was !== active) {
    setWas(active);
    setNow(clock.serverNow());
  }
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      setNow(clock.serverNow());
    }, 1000);
    return () => {
      clearInterval(t);
    };
  }, [active]);
  return now;
}
