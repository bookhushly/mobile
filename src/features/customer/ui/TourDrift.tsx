import type { ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type Props = {
  scrollX: SharedValue<number>;
  index: number;
  width: number;
  /** How far it trails the page as it slides: higher drifts more (depth). */
  depth: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * Moves a tour piece against the page as the pager slides, so the pieces read as layers. Only the
 * pieces that drift wrap themselves in this, so only they do work on each scroll frame (perf
 * review, 2026-11-17: every piece used to).
 */
export function TourDrift({ scrollX, index, width, depth, style, children }: Props) {
  const drift = useAnimatedStyle(() => ({
    transform: [{ translateX: (scrollX.get() - index * width) * depth }],
  }));
  return <Animated.View style={[style, drift]}>{children}</Animated.View>;
}
