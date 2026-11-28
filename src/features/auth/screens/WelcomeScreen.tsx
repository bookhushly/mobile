import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useContext, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { WelcomeSlides } from '@/features/auth/components/WelcomeSlides';
import { WELCOME_ENTERS_AT, welcomeUnderIntro } from '@/features/auth/launchIntro';
import type { AuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { color, layout, motion, space } from '@/shared/theme';
import { Banner, Button, TextLink, useDensity } from '@/shared/ui';
import { useMotionTier } from '@/shared/ui/motion';

const wordmark = require('../../../../assets/images/logo-wordmark.png') as number;

// The full logo, drawn from the vector (assets/brand/bookhushly-lockup-ink.svg): 1288 x 364. Big
// enough to read as the brand, not a corner label.
const WORDMARK_HEIGHT = 40;
const WORDMARK_WIDTH = (WORDMARK_HEIGHT * 1288) / 364;
// How far above the text the fade starts from clear.
const FADE_ABOVE_PT = 120;
// Logo, slides, then actions: a small fade and lift, one after another, no bounce.
const [w1, w2, w3, w4] = motion.easing.decelerate;
const RISE_EASE = Easing.bezier(w1, w2, w3, w4);
// Logo, words, then actions rise in one after another. On a cold start they wait for the intro
// so the entrance is seen, not played under the violet layer.
function enter(step: number, after: number) {
  return FadeInDown.duration(motion.duration.sheet)
    .delay(after + step * motion.duration.fast)
    .easing(RISE_EASE)
    .withInitialValues({ opacity: 0, transform: [{ translateY: space.s5 }] });
}

type Props = {
  notice: AuthNotice;
  onDismissNotice: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onBrowse: () => void;
};

// Landing screen when signed out and not browsing: create account first, sign in second
// (spec §2 decision 1).
// Draws over AuthBackdrop's photo, so it has no background of its own.
export function WelcomeScreen({
  notice,
  onDismissNotice,
  onCreateAccount,
  onSignIn,
  onBrowse,
}: Props) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  const still = useMotionTier() === 'none';
  // Decided once, on the first frame: the intro is about to play over this screen.
  const [after] = useState(() => (welcomeUnderIntro() ? WELCOME_ENTERS_AT : 0));
  // Side by side where "Create account" fits on one line; stacked where it would wrap (iPhone SE,
  // 375 pt, or large text: device check 2026-11-28). Latched per width and text size, since the
  // stacked pill is wide enough to fit and would otherwise flip back.
  const d = useDensity();
  const { width, fontScale } = useWindowDimensions();
  const fitKey = `${String(width)}:${String(fontScale)}`;
  const [wrappedAt, setWrappedAt] = useState<string | null>(null);
  const stacked = wrappedAt === fitKey;
  return (
    <View style={{ flex: 1 }}>
      {/* Sits at the bottom until large text or the notice outgrow the screen, then scrolls, so the
          terms stay reachable. */}
      <ScrollView
        testID="welcome-scroll"
        style={{ flex: 1 }}
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'flex-end',
          paddingTop: insets.top + space.s4,
        }}
      >
        <View
          testID="welcome-content"
          style={{
            paddingHorizontal: layout.formGutter,
            paddingBottom: Math.max(insets.bottom, space.s5),
          }}
        >
          {/* Grows with the text, so large type never rises above the fade onto bare photo. */}
          <LinearGradient
            colors={[color.scrim[0], color.scrim[1]]}
            style={{
              position: 'absolute',
              top: -FADE_ABOVE_PT,
              left: 0,
              right: 0,
              height: FADE_ABOVE_PT,
            }}
          />
          <LinearGradient
            testID="welcome-fade"
            colors={[color.scrim[1], color.scrim[2]]}
            style={StyleSheet.absoluteFill}
          />
          {notice === 'accountDeleted' ? (
            <View style={{ marginBottom: space.s5 }}>
              <Banner
                tone="info"
                message="Your account was deleted."
                action={{ label: 'OK', onPress: onDismissNotice }}
              />
            </View>
          ) : null}
          <Animated.View entering={still ? undefined : enter(0, after)}>
            <View accessible accessibilityRole="image" accessibilityLabel="Bookhushly">
              <Image
                source={wordmark}
                style={{ width: WORDMARK_WIDTH, height: WORDMARK_HEIGHT }}
                contentFit="contain"
                tintColor={color.onInverse}
              />
            </View>
          </Animated.View>
          <Animated.View
            entering={still ? undefined : enter(1, after)}
            style={{ marginTop: space.s7 }}
          >
            <WelcomeSlides />
          </Animated.View>
          <Animated.View
            entering={still ? undefined : enter(2, after)}
            style={{ marginTop: space.s7 }}
          >
            {/* Side by side, as Nike and IHG do: two equal choices, neither a full-width slab. Where
                "Create account" would wrap (a 375 pt phone, large text) they stack instead, a
                touch-target gap apart. */}
            <View
              testID="welcome-actions"
              style={{
                flexDirection: stacked ? 'column' : 'row',
                gap: stacked ? d.targetGap : space.s3,
              }}
            >
              <View style={stacked ? null : { flex: 1 }}>
                <Button
                  label="Create account"
                  onInverse="light"
                  onPress={onCreateAccount}
                  onLabelLines={(lines) => {
                    if (!stacked && lines > 1) setWrappedAt(fitKey);
                  }}
                />
              </View>
              <View style={stacked ? null : { flex: 1 }}>
                <Button label="Sign in" variant="secondary" onInverse="light" onPress={onSignIn} />
              </View>
            </View>
            <View testID="welcome-browse" style={{ marginTop: space.s5, alignItems: 'center' }}>
              <TextLink
                size="lg"
                label="Browse without an account"
                tone="onInverse"
                onPress={onBrowse}
              />
            </View>
          </Animated.View>
        </View>
      </ScrollView>
    </View>
  );
}
