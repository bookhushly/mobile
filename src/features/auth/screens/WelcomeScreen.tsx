import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useContext } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { TermsLine } from '@/features/auth/components/TermsLine';
import type { AuthNotice } from '@/features/auth/hooks/useAuthNotice';
import { color, layout, motion, space } from '@/shared/theme';
import { Banner, Button, Stack, Text } from '@/shared/ui';
import { useMotionTier } from '@/shared/ui/motion';

const wordmark = require('../../../../assets/images/logo-wordmark.png') as number;

// Wordmark file is 319 x 91.
const WORDMARK_HEIGHT = 24;
const WORDMARK_WIDTH = (WORDMARK_HEIGHT * 319) / 91;
// How far above the text the fade starts from clear.
const FADE_ABOVE_PT = 120;

type Props = {
  notice: AuthNotice;
  onDismissNotice: () => void;
  onCreateAccount: () => void;
  onSignIn: () => void;
  onOpenLink: (url: string) => void;
};

// Landing screen whenever signed out: create account first, sign in second (spec §2 decision 1).
// Draws over AuthBackdrop's photo, so it has no background of its own.
export function WelcomeScreen({
  notice,
  onDismissNotice,
  onCreateAccount,
  onSignIn,
  onOpenLink,
}: Props) {
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  const tier = useMotionTier();
  const entering = tier === 'none' ? undefined : FadeIn.duration(motion.duration.moderate);
  return (
    <View style={{ flex: 1 }}>
      <View
        accessible
        accessibilityRole="image"
        accessibilityLabel="Bookhushly"
        style={{
          position: 'absolute',
          top: insets.top + space.s4,
          left: layout.phoneGutter,
        }}
      >
        <Image
          source={wordmark}
          style={{ width: WORDMARK_WIDTH, height: WORDMARK_HEIGHT }}
          contentFit="contain"
          tintColor={color.onInverse}
        />
      </View>
      <Animated.View
        testID="welcome-content"
        entering={entering}
        style={{
          marginTop: 'auto',
          paddingHorizontal: layout.phoneGutter,
          paddingBottom: Math.max(insets.bottom, space.s5),
          gap: space.s5,
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
          <Banner
            tone="info"
            message="Your account was deleted."
            action={{ label: 'OK', onPress: onDismissNotice }}
          />
        ) : null}
        <Stack gap="s3">
          <Text variant="displaySm" tone="onInverse" accessibilityRole="header">
            Events, stays and hotels across Nigeria.
          </Text>
          <Text variant="body" tone="onInverse">
            Find it, book it, pay in naira.
          </Text>
        </Stack>
        <Stack gap="s2">
          <Button label="Create account" onInverse="light" onPress={onCreateAccount} />
          <Button label="Sign in" variant="ghost" onInverse="light" onPress={onSignIn} />
          <TermsLine inverse onOpenLink={onOpenLink} />
        </Stack>
      </Animated.View>
    </View>
  );
}
