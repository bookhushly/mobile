import { useEffect, useState } from 'react';

import { Text } from '@/shared/ui';

/** 0:42 — minutes and two-digit seconds. */
export function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)}:${s < 10 ? '0' : ''}${String(s)}`;
}

export const DEFAULT_WAIT_SEC = 60;

type Props = {
  retryAfterSec: number | null;
  /** Called once the countdown reaches 0 (a caller can turn its action back on). */
  onDone?: () => void;
};

// Spec E10 / ruling (b): a 429 counts down. UX review U1: the ticking line is plain text, never a
// live region (the Banner above it keeps a fixed message), so it isn't read out every second.
export function RateLimitWait({ retryAfterSec, onDone }: Props) {
  const total = Math.max(0, Math.ceil(retryAfterSec ?? DEFAULT_WAIT_SEC));
  const [left, setLeft] = useState(total);
  useEffect(() => {
    const until = Date.now() + total * 1000;
    const id = setInterval(() => {
      const s = Math.max(0, Math.ceil((until - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) clearInterval(id);
    }, 1_000);
    return () => {
      clearInterval(id);
    };
  }, [total]);
  useEffect(() => {
    if (left === 0) onDone?.();
  }, [left, onDone]);
  return (
    <Text variant="bodySm" tone="textSecondary" tabular testID="rate-limit-wait">
      {left > 0 ? `You can try again in ${mmss(left)}` : 'You can try again now.'}
    </Text>
  );
}
