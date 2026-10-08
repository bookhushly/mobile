import { useEffect } from 'react';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';

import { color } from '@/shared/theme';

import { useMotionTier } from './motion';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const CHECK_LENGTH = 60;
const DRAW_MS = 400;

// MOTION inventory #7 fallback: a drawn check. The stroke draws in 400 ms only on tier `full`
// with `animate`; otherwise it is static. Decorative: the surrounding copy carries the outcome.
export function SuccessMark({ size = 96, animate = false }: { size?: number; animate?: boolean }) {
  const tier = useMotionTier();
  const run = animate && tier === 'full';
  const offset = useSharedValue(run ? CHECK_LENGTH : 0);
  useEffect(() => {
    if (run) offset.set(withTiming(0, { duration: DRAW_MS }));
    else offset.set(0);
  }, [run, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));
  return (
    <Svg
      testID="success-mark"
      width={size}
      height={size}
      viewBox="0 0 96 96"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Circle cx={48} cy={48} r={44} fill={color.status.success.solid} />
      <AnimatedPath
        d="M28 50l14 14 26-30"
        stroke={color.onAction}
        strokeWidth={8}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
        strokeDasharray={CHECK_LENGTH}
        animatedProps={props}
      />
    </Svg>
  );
}
