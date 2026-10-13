import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { useServerNow } from '@/features/customer/hooks/useServerNow';
import { clock } from '@/shared/api/instance';
import { color, iconSize, motion } from '@/shared/theme';
import { Text, useMotionTier } from '@/shared/ui';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
// The server's code step (C7): a full ring is one step.
const STEP_MS = 30_000;
const STROKE = 3;
const LINEAR = Easing.bezier(...motion.easing.linear);

type Props = { expiresAt: number; size?: number };

function remainingMs(expiresAt: number, now: number): number {
  return Math.min(STEP_MS, Math.max(0, expiresAt - now));
}

function geometry(size: number) {
  const r = (size - STROKE) / 2;
  return { r, c: 2 * Math.PI * r, mid: size / 2 };
}

// Sweeps down to `expiresAt` on the UI thread: one timing per code, no per-second JS work.
function SweepRing({ expiresAt, size }: Required<Props>) {
  const { r, c, mid } = geometry(size);
  const offset = useSharedValue(0);
  useEffect(() => {
    const left = remainingMs(expiresAt, clock.serverNow());
    offset.set(c * (1 - left / STEP_MS));
    offset.set(withTiming(c, { duration: left, easing: LINEAR }));
  }, [expiresAt, c, offset]);
  const props = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));
  return (
    <Svg width={size} height={size} testID="countdown-ring-sweep">
      <Circle cx={mid} cy={mid} r={r} stroke={color.border} strokeWidth={STROKE} fill="none" />
      <AnimatedCircle
        cx={mid}
        cy={mid}
        r={r}
        stroke={color.textPrimary}
        strokeWidth={STROKE}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={c}
        transform={`rotate(-90 ${String(mid)} ${String(mid)})`}
        animatedProps={props}
      />
    </Svg>
  );
}

// Reduce Motion (spec §6): no sweep; a still ring with the seconds left as text.
function StaticRing({ expiresAt, size }: Required<Props>) {
  const { r, mid } = geometry(size);
  const now = useServerNow();
  const secs = Math.ceil(remainingMs(expiresAt, now) / 1000);
  return (
    <View
      testID="countdown-ring-static"
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={mid}
          cy={mid}
          r={r}
          stroke={color.textPrimary}
          strokeWidth={STROKE}
          fill="none"
        />
      </Svg>
      <Text variant="caption" tabular maxScale={1}>
        {String(secs)}
      </Text>
    </View>
  );
}

// C11: counts down to the next code. Decorative: "refreshes every 30 s" carries the meaning.
export function CountdownRing({ expiresAt, size = iconSize.lg }: Props) {
  const tier = useMotionTier();
  return (
    <View
      testID="countdown-ring"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {tier === 'none' ? (
        <StaticRing expiresAt={expiresAt} size={size} />
      ) : (
        <SweepRing expiresAt={expiresAt} size={size} />
      )}
    </View>
  );
}
