import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { usePathname } from 'expo-router';
import { useContext, useEffect, useState } from 'react';
import { AccessibilityInfo, AppState, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { SLIDE_MS, WELCOME_SLIDES, type WelcomePhoto } from '@/features/auth/domain/welcomeSlides';
import { useWelcomeSlide } from '@/features/auth/hooks/useWelcomeSlide';
import { noteWelcomeDrawn } from '@/features/auth/launchIntro';
import { color, motion } from '@/shared/theme';
import { useMotionTier } from '@/shared/ui/motion';

export const AUTH_PHOTOS: Record<WelcomePhoto, number> = {
  hotel: require('../../../../assets/images/auth/hotel.webp') as number,
  event: require('../../../../assets/images/auth/event.webp') as number,
  apartment: require('../../../../assets/images/auth/apartment.webp') as number,
};

// Below the safe area: enough to carry the logo and the back button on a pale photo.
const TOP_FADE_PT = 160;
// Stays at full strength past the status bar and logo, so they read on any photo.
export const TOP_FADE_HOLD = 0.4;

const [d1, d2, d3, d4] = motion.easing.sheet;
const DIM = { duration: motion.duration.sheet, easing: Easing.bezier(d1, d2, d3, d4) };

// Sits behind the auth stack, so the photo stays still as routes change. Brand imagery only.
export function AuthBackdrop() {
  const onWelcome = usePathname() === '/welcome';
  const tier = useMotionTier();
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0 };
  const index = useWelcomeSlide((s) => s.index);
  const chosen = useWelcomeSlide((s) => s.chosen);
  const advance = useWelcomeSlide((s) => s.advance);
  const [foreground, setForeground] = useState(AppState.currentState !== 'background');

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      setForeground(next === 'active');
    });
    return () => {
      sub.remove();
    };
  }, []);

  // A screen reader user is never moved off the slide they are reading.
  const [screenReader, setScreenReader] = useState(false);
  useEffect(() => {
    let live = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (live) setScreenReader(on);
    });
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      live = false;
      sub.remove();
    };
  }, []);

  // The slideshow clock lives here, beside the photo it changes; Welcome's words follow the store.
  const cycling = onWelcome && foreground && tier !== 'none' && !chosen && !screenReader;
  useEffect(() => {
    if (!cycling) return;
    const id = setInterval(advance, SLIDE_MS);
    return () => {
      clearInterval(id);
    };
  }, [cycling, advance]);
  const photo = WELCOME_SLIDES[index]?.photo ?? 'hotel';

  // Behind a form the photo steps back, so the sheet is the only thing to look at.
  const dim = useSharedValue(onWelcome ? 0 : 1);
  useEffect(() => {
    const to = onWelcome ? 0 : 1;
    // Same curve and length as the sheet rising over it, so the two move as one.
    dim.set(tier === 'none' ? to : withTiming(to, DIM));
  }, [onWelcome, tier, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.get() }));

  return (
    <View
      style={[StyleSheet.absoluteFill, { backgroundColor: color.inverse }]}
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Image
        testID="auth-photo"
        source={AUTH_PHOTOS[photo]}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        cachePolicy="memory"
        priority="high"
        transition={tier === 'none' ? 0 : motion.duration.slow}
        // The photo is on screen: the opening intro may dissolve onto it (perf review: layout
        // alone came before the photo decoded, so the violet could fade onto a bare dark screen).
        onDisplay={noteWelcomeDrawn}
      />
      <Animated.View
        testID="auth-dim"
        style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim[1] }, dimStyle]}
      />
      <LinearGradient
        testID="auth-top-fade"
        colors={[color.scrim[1], color.scrim[1], color.scrim[0]]}
        locations={[0, TOP_FADE_HOLD, 1]}
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
