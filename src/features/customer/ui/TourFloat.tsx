import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedReaction,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { TourDrift } from '@/features/customer/ui/TourDrift';
import { motion, type MotionTier } from '@/shared/theme';

/** What a slide's pieces share, worked out once per slide (TourPanel). */
export type TourMotion = {
  /** The pager's horizontal offset, updated on the UI thread (drift only). */
  scrollX: SharedValue<number>;
  /** This page's place in the pager and the page width. */
  index: number;
  width: number;
  /** 0 until the slide first arrives; then 1, or 2 when it's the slide the tour opens on. */
  arrived: SharedValue<number>;
  /** Read once by the screen and passed down. */
  tier: MotionTier;
};

/** Where a piece comes from (offsets from its resting place), and when, in ms after arrival. */
export type TourEntrance = {
  x?: number;
  y?: number;
  /** Extra degrees of tilt it starts with, settling to its resting tilt. */
  turn?: number;
  scale?: number;
  delay: number;
  /** A small tag landing: the playful spring, with a touch of overshoot. */
  pop?: boolean;
};

type Props = TourMotion & {
  /** How far it trails the page as it slides: 0 moves with it, higher drifts more (depth). */
  depth?: number;
  /** Resting tilt in degrees, for a hand-placed look. */
  tilt?: number;
  enter: TourEntrance;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

// Hero-sequence timings (MOTION.md "Customer tour"): slides travel 520 ms; the slide the tour
// opens on waits 250 ms, since its first frame is busy mounting the pager and decoding photos.
const SLIDE_MS = 520;
const OPENING_LEAD = 250;
const OPENING = 2;
const [x1, y1, x2, y2] = motion.easing.decelerate;

/**
 * A piece of the tour's panel (owner's pick A, 2026-11-15, after Mindtrip and Rodeo). Each slide
 * tells its line in motion the first time it arrives: pieces come in from where they'd naturally
 * come, one after another, and settle at a hand-placed tilt; the ones with depth drift against
 * the page as the pager slides. Transform and opacity only, on the UI thread. The entrance waits
 * on the slide's one arrival value, never on each scroll frame. Reduced tier: a plain fade, no
 * drift. Reduce Motion: shown at rest.
 */
export function TourFloat({
  scrollX,
  index,
  width,
  arrived,
  tier,
  depth = 0,
  tilt = 0,
  enter,
  style,
  children,
}: Props) {
  const still = tier === 'none';
  const full = tier === 'full';
  const shown = useSharedValue(still ? 1 : 0);
  const played = useSharedValue(still);

  useAnimatedReaction(
    () => arrived.get(),
    (a) => {
      if (a === 0 || played.get()) return;
      played.set(true);
      const lead = a === OPENING ? OPENING_LEAD : 0;
      if (!full) {
        shown.set(withDelay(lead, withTiming(1, { duration: motion.duration.base })));
        return;
      }
      shown.set(
        withDelay(
          lead + enter.delay,
          enter.pop
            ? withSpring(1, motion.spring.playful)
            : withTiming(1, { duration: SLIDE_MS, easing: Easing.bezier(x1, y1, x2, y2) }),
        ),
      );
    },
  );

  const fromX = full ? (enter.x ?? 0) : 0;
  const fromY = full ? (enter.y ?? 0) : 0;
  const fromTurn = full ? (enter.turn ?? 0) : 0;
  const fromScale = full ? (enter.scale ?? 1) : 1;
  const entrance = useAnimatedStyle(() => {
    const away = 1 - shown.get();
    return {
      // A pop's spring overshoots; opacity never goes past full.
      opacity: Math.min(1, shown.get() * 1.5),
      transform: [
        { translateX: away * fromX },
        { translateY: away * fromY },
        { rotate: `${String(tilt + away * fromTurn)}deg` },
        { scale: 1 - away * (1 - fromScale) },
      ],
    };
  });

  if (full && depth > 0)
    return (
      <TourDrift scrollX={scrollX} index={index} width={width} depth={depth} style={style}>
        <Animated.View style={entrance}>{children}</Animated.View>
      </TourDrift>
    );
  return <Animated.View style={[style, entrance]}>{children}</Animated.View>;
}
