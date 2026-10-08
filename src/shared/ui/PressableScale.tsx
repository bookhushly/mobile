import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';

import { motion } from '@/shared/theme';

import { useMotionTier } from './motion';

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle> | ((s: { pressed: boolean }) => StyleProp<ViewStyle>);
  children: ReactNode;
};

// Inventory #3: scale 0.97 on press (transform only), skipped under `none`.
// The animated wrapper sits inside the Pressable so the hit area never shrinks.
// `.get()`/`.set()` rather than `.value`: required under the React Compiler (Reanimated docs).
export function PressableScale({ style, children, onPressIn, onPressOut, ...rest }: Props) {
  const tier = useMotionTier();
  const scale = useSharedValue(1);
  const animated = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  return (
    <Pressable
      {...rest}
      style={style}
      onPressIn={(e) => {
        if (tier !== 'none') scale.set(withSpring(0.97, motion.spring.press));
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (tier !== 'none') scale.set(withSpring(1, motion.spring.press));
        onPressOut?.(e);
      }}
    >
      <Animated.View style={animated}>{children}</Animated.View>
    </Pressable>
  );
}
