import { Image } from 'expo-image';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { CYCLE_MS, nextPhotoIndex } from '@/features/auth/domain/authBackdrop';
import { color, motion } from '@/shared/theme';
import { useMotionTier } from '@/shared/ui/motion';

// Index 0 is the default for any route reached without passing Welcome.
export const AUTH_PHOTOS = [
  require('../../../../assets/images/auth/hotel.webp') as number,
  require('../../../../assets/images/auth/event.webp') as number,
  require('../../../../assets/images/auth/apartment.webp') as number,
];

// Sits behind the auth stack, so the photo stays still as routes change. Brand imagery only.
export function AuthBackdrop() {
  const onWelcome = usePathname() === '/welcome';
  const tier = useMotionTier();
  const [index, setIndex] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');

  useEffect(() => {
    for (const photo of AUTH_PHOTOS) void Image.loadAsync(photo).catch(() => undefined);
  }, []);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setForeground(next === 'active');
    });
    return () => {
      sub.remove();
    };
  }, []);

  const cycling = onWelcome && foreground && tier !== 'none';
  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(() => {
      setIndex(nextPhotoIndex);
    }, CYCLE_MS);
    return () => {
      clearInterval(id);
    };
  }, [cycling]);

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: color.inverse }]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        testID="auth-photo"
        source={AUTH_PHOTOS[index]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={motion.duration.slow}
      />
    </View>
  );
}
