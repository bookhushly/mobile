import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { maskEmail } from '@/shared/lib/maskEmail';
import { createFeedback } from '@/shared/platform/feedback';
import { motion, space } from '@/shared/theme';
import { Button, Screen, SuccessMark, Text, useMotionTier } from '@/shared/ui';

type Props = {
  isEvent: boolean;
  title: string;
  /** Dates or event time. */
  when: string;
  /** Where the confirmation went; the line is left out without one. */
  email: string | null;
  onView: () => void;
  onDone: () => void;
};

const START_SCALE = 0.8;

// MOTION #7 tier 1 (code-built until the Lottie lands, M6): the check fades and scales in once,
// ≤ 300 ms, on tier `full` only; Reduce Motion shows it still.
function Tick() {
  const run = useMotionTier() === 'full';
  const shown = useSharedValue(run ? 0 : 1);
  useEffect(() => {
    if (run) shown.set(withTiming(1, { duration: motion.duration.moderate }));
    else shown.set(1);
  }, [run, shown]);
  const style = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ scale: START_SCALE + (1 - START_SCALE) * shown.get() }],
  }));
  return (
    <Animated.View style={style} testID="booked-tick">
      <SuccessMark size={72} />
    </Animated.View>
  );
}

// Spec P20, Mobbin §5: "You're booked", key facts, View tickets / View booking, then Done.
export function BookedDone({ isEvent, title, when, email, onView, onDone }: Props) {
  // Haptic only, never the gate's sounds (not loaded).
  const [feedback] = useState(createFeedback);
  // StrictMode (dev) runs mount effects twice; the ref keeps it to one buzz.
  const buzzed = useRef(false);
  useEffect(() => {
    if (buzzed.current) return;
    buzzed.current = true;
    feedback.cue('success');
  }, [feedback]);

  return (
    <Screen
      scroll
      footer={
        <View style={{ gap: space.s3 }}>
          <Button label={isEvent ? 'View tickets' : 'View booking'} onPress={onView} />
          <Button label="Done" variant="secondary" onPress={onDone} />
        </View>
      }
    >
      <View style={{ gap: space.s4, paddingTop: space.s9 }} testID="booked-done">
        <Tick />
        <Text
          variant="display"
          tone="successFg"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          You’re booked
        </Text>
        <View style={{ gap: space.s1 }}>
          {title !== '' ? <Text variant="bodyStrong">{title}</Text> : null}
          {when !== '' ? (
            <Text variant="body" tone="textSecondary">
              {when}
            </Text>
          ) : null}
        </View>
        {email !== null && email !== '' ? (
          <Text variant="body" tone="textSecondary">
            {`Confirmation sent to ${maskEmail(email)}`}
          </Text>
        ) : null}
      </View>
    </Screen>
  );
}
