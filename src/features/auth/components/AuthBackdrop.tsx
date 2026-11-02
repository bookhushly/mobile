import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { CYCLE_MS, nextPhotoIndex } from '@/features/auth/domain/authBackdrop';
import { color, motion } from '@/shared/theme';
import { useMotionTier } from '@/shared/ui/motion';

// Index 0 is the default for any route reached without passing Welcome.
export const AUTH_PHOTOS = [
  require('../../../../assets/images/auth/hotel.webp') as number,
  require('../../../../assets/images/auth/event.webp') as number,
  require('../../../../assets/images/auth/apartment.webp') as number,
];

// Below the safe area: enough to carry the logo and the back button on a pale photo.
const TOP_FADE_PT = 96;

// Sits behind the auth stack, so the photo stays still as routes change. Brand imagery only.
export function AuthBackdrop() {
  const onWelcome = usePathname() === '/welcome';
  const tier = useMotionTier();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0 };
  const [index, setIndex] = useState(0);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');

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
        cachePolicy="memory"
        priority="high"
        transition={tier === 'none' ? 0 : motion.duration.slow}
      />
      <LinearGradient
        testID="auth-top-fade"
        colors={[color.scrim[1], color.scrim[0]]}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: insets.top + TOP_FADE_PT,
        }}
      />
    </View>
  );
}
