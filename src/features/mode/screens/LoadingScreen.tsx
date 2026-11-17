import { Image } from 'expo-image';
import { View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { color, motion, space } from '@/shared/theme';
import { Spinner, Text, useMotionTier } from '@/shared/ui';

const mark = require('../../../../assets/images/brand-mark-white.png') as number;
// Same size and place as the native splash (app.json `imageWidth`) and the opening screen, so a
// slow sign-in check reads as the splash carrying on, not a different screen.
const MARK_PT = 72;
// A normal launch is over before this; only a slow one shows the progress line.
const SHOW_PROGRESS_AFTER_MS = 900;

type Props = {
  /** Off under a redirect: the view only covers the hand-off, so nothing keeps spinning beneath. */
  progress?: boolean;
};

// Shown between the splash hiding (2 s cap in the root layout) and the route resolving.
export function LoadingScreen({ progress = true }: Props) {
  const still = useMotionTier() === 'none';
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: color.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View accessible accessibilityRole="image" accessibilityLabel="Bookhushly">
        <Image source={mark} style={{ width: MARK_PT, height: MARK_PT }} contentFit="contain" />
      </View>
      {/* Absolute, so the mark stays exactly where the splash put it. */}
      {progress ? (
        <Animated.View
          entering={
            still
              ? undefined
              : FadeIn.duration(motion.duration.moderate).delay(SHOW_PROGRESS_AFTER_MS)
          }
          style={{
            position: 'absolute',
            bottom: space.s11 * 2,
            alignItems: 'center',
            gap: space.s3,
          }}
        >
          <Spinner tone="onInverse" label="Loading" />
          <Text variant="bodySm" tone="onInverse" accessibilityLiveRegion="polite">
            Loading your account…
          </Text>
        </Animated.View>
      ) : null}
    </View>
  );
}
