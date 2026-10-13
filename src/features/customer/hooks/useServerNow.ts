import { useEffect, useState } from 'react';

import { clock } from '@/shared/api/instance';

const SECOND_MS = 1000;

/** Server time (epoch ms), re-read on each whole second: for on-screen clocks and countdowns. */
export function useServerNow(): number {
  const [now, setNow] = useState(() => clock.serverNow());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Lands just after each second boundary, so the shown seconds never skip or repeat.
    const tick = () => {
      const t = clock.serverNow();
      setNow(t);
      timer = setTimeout(tick, SECOND_MS - (t % SECOND_MS));
    };
    const t = clock.serverNow();
    timer = setTimeout(tick, SECOND_MS - (t % SECOND_MS));
    return () => {
      if (timer !== null) clearTimeout(timer);
    };
  }, []);
  return now;
}
