import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import type { DensityName, MotionTier } from '@/shared/theme';

import { useDensityName } from './DensityProvider';

const BY_DENSITY: Record<DensityName, MotionTier> = {
  customer: 'full',
  work: 'reduced',
  gate: 'reduced',
};

// MOTION.md §6: every animation reads this. Reduce Motion wins and is followed live.
export function useMotionTier(): MotionTier {
  const name = useDensityName();
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((on) => {
      if (live) setReduce(on);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);
  return reduce ? 'none' : BY_DENSITY[name];
}
