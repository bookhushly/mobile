import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { DensityName, MotionTier } from '@/shared/theme';

import { useDensityName } from './DensityProvider';

const BY_DENSITY: Record<DensityName, MotionTier> = {
  customer: 'full',
  work: 'reduced',
  gate: 'reduced',
};

// The last answer the OS gave, so a screen that mounts later is right on its first render instead
// of animating until its own check resolves (UX review, 2026-11-17). Asked once at load.
let lastReduce = false;
void AccessibilityInfo.isReduceMotionEnabled()
  .then((on) => {
    lastReduce = on;
  })
  .catch(() => undefined);

// MOTION.md §6: every animation reads this. Reduce Motion wins and is followed live.
export function useMotionTier(): MotionTier {
  const name = useDensityName();
  const [reduce, setReduce] = useState(lastReduce);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      lastReduce = on;
      if (live) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (on) => {
      lastReduce = on;
      setReduce(on);
    });
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce ? 'none' : BY_DENSITY[name];
}
