import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { motion } from '@/shared/theme';

import { useMotionTier } from './motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: ReactNode;
};

// The whole control scales as one piece (fill, border and label), inside a wrapper that keeps the
// keys placing it on the page. The 3% squeeze of the hit area is imperceptible.
const PLACEMENT = new Set<string>([
  'margin',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
  'marginHorizontal',
  'marginVertical',
  'position',
  'top',
  'bottom',
  'left',
  'right',
  'zIndex',
  'alignSelf',
]);
// flex and width are both: the wrapper takes the space and the button fills it.
const SHARED = new Set<string>(['flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width']);

function split(style: StyleProp<ViewStyle>): { outer: ViewStyle; inner: ViewStyle } {
  // The trailing {} makes flatten return an object even when there is no style.
  const flat = Object.entries(StyleSheet.flatten([style, {}]));
  const outer: ViewStyle = {};
  const inner: ViewStyle = {};
  for (const [k, v] of flat) {
    const o = outer as Record<string, unknown>;
    const i = inner as Record<string, unknown>;
    if (PLACEMENT.has(k)) o[k] = v;
    else if (SHARED.has(k)) {
      o[k] = v;
      i[k] = v;
    } else i[k] = v;
  }
  return { outer, inner };
}

// Press feedback (inventory #3, expo-animation skill): scale to 0.97 on press-in, back on release,
// a short ease-out on the UI thread. Skipped under Reduce Motion (the pressed colour still shows).
const PRESSED = 0.97;
const [x1, y1, x2, y2] = motion.easing.decelerate;
const EASE_OUT = Easing.bezier(x1, y1, x2, y2);
const IN = { duration: motion.duration.fast, easing: EASE_OUT };
const OUT = { duration: motion.duration.base, easing: EASE_OUT };

export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: Props) {
  const tier = useMotionTier();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const resolve = (pressed: boolean) =>
    split(typeof style === 'function' ? style({ pressed }) : style);
  const placed = split(typeof style === 'function' ? style({ pressed: false }) : style).outer;
  return (
    <Animated.View style={[placed, animated]}>
      <Pressable
        {...rest}
        // Releasing more than 16 pt outside cancels the press: a little tighter than React
        // Native's default, so a slide off a button never counts as a tap (gate review).
        pressRetentionOffset={rest.pressRetentionOffset ?? 16}
        style={(state) => resolve(state.pressed).inner}
        onPressIn={(e) => {
          if (tier !== 'none') scale.set(withTiming(PRESSED, IN));
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          if (tier !== 'none') scale.set(withTiming(1, OUT));
          onPressOut?.(e);
        }}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
