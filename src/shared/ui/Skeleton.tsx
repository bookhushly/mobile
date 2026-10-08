import { useEffect, useState } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { color, radius as radii, space, type RadiusKey } from '@/shared/theme';

import { useMotionTier } from './motion';

type Props = {
  width?: number | `${number}%`;
  height: number;
  radius?: RadiusKey;
  /** Shown only after this delay so quick loads never flash a placeholder. */
  delayMs?: number;
  testID?: string;
};

const PULSE_MS = 600;
const PULSE_MIN_OPACITY = 0.5;

// DESIGN_SYSTEM §6 / MOTION.md: only after 150 ms; pulses (opacity only) on `full`, static otherwise.
export function Skeleton({
  width = '100%',
  height,
  radius = 'r2',
  delayMs = 150,
  testID = 'skeleton',
}: Props) {
  const tier = useMotionTier();
  const [shown, setShown] = useState(delayMs === 0);
  const opacity = useSharedValue(1);
  useEffect(() => {
    if (delayMs === 0) return;
    const t = setTimeout(() => {
      setShown(true);
    }, delayMs);
    return () => {
      clearTimeout(t);
    };
  }, [delayMs]);
  const pulse = shown && tier === 'full';
  useEffect(() => {
    if (pulse) {
      opacity.set(withRepeat(withTiming(PULSE_MIN_OPACITY, { duration: PULSE_MS }), -1, true));
    } else {
      opacity.set(1);
    }
  }, [pulse, opacity]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));
  if (!shown) return null;
  return (
    <Animated.View
      testID={testID}
      accessibilityHint={pulse ? 'pulse' : 'static'}
      style={[{ width, height, borderRadius: radii[radius], backgroundColor: color.wash }, style]}
    />
  );
}

// Mirrors ListRow: leading square, two lines. Announced once as "Loading".
export function SkeletonRows({ count }: { count: number }) {
  return (
    <View accessibilityLabel="Loading" accessible style={{ gap: space.s4 }}>
      {Array.from({ length: count }, (_, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: space.s4, alignItems: 'center' }}>
          <Skeleton width={48} height={48} radius="r3" />
          <View style={{ flex: 1, gap: space.s2 }}>
            <Skeleton height={16} width="70%" />
            <Skeleton height={12} width="45%" />
          </View>
        </View>
      ))}
    </View>
  );
}
