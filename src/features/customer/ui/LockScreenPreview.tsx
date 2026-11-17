import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, FadeInDown } from 'react-native-reanimated';

import { color, motion, radius, space } from '@/shared/theme';
import { Text, useMotionTier } from '@/shared/ui';

// Brand imagery only (the Welcome event photo), never a listing.
const photo = require('../../../../assets/images/auth/event.webp') as number;
const mark = require('../../../../assets/images/brand-mark-white.png') as number;

const PHONE_WIDTH = 280;
const BEZEL = 8;
const SCREEN_RADIUS = 40;
const APP_ICON = 36;
const APP_MARK = 22;
// White glass over the photo: readable, with the picture still showing through at the edges.
const GLASS = 0.92;

type Sample = { title: string; body: string; when: string };

// Made-up examples of what the app sends; no real venue named.
const SAMPLES: readonly Sample[] = [
  {
    title: 'Your ticket is ready',
    body: 'Lagos Jazz Night, Saturday 7 pm. Show your code at the door.',
    when: 'now',
  },
  { title: 'Check-in tomorrow', body: 'Your Ikoyi stay starts at 2 pm.', when: '2h ago' },
];

const [e1, e2, e3, e4] = motion.easing.decelerate;
const EASE_OUT = Easing.bezier(e1, e2, e3, e4);
// First-time screen, so it earns a little delight: the notifications arrive one after another.
function arrive(i: number) {
  return FadeInDown.duration(motion.duration.sheet)
    .delay(motion.duration.moderate + i * motion.duration.moderate)
    .easing(EASE_OUT)
    .withInitialValues({ opacity: 0, transform: [{ translateY: -space.s5 }] });
}

function Notification({ sample }: { sample: Sample }) {
  return (
    <View style={{ borderRadius: radius.r4, borderCurve: 'continuous', overflow: 'hidden' }}>
      <View style={[StyleSheet.absoluteFill, { backgroundColor: color.surface, opacity: GLASS }]} />
      <View style={{ flexDirection: 'row', gap: space.s4, padding: space.s4 }}>
        <View
          style={{
            width: APP_ICON,
            height: APP_ICON,
            borderRadius: radius.r2,
            borderCurve: 'continuous',
            backgroundColor: color.brand,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image source={mark} style={{ width: APP_MARK, height: APP_MARK }} contentFit="contain" />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <Text variant="labelSm" numberOfLines={1}>
              {sample.title}
            </Text>
            <Text variant="caption" tone="textSecondary">
              {sample.when}
            </Text>
          </View>
          <Text variant="caption" tone="textSecondary">
            {sample.body}
          </Text>
        </View>
      </View>
    </View>
  );
}

// A phone showing the lock screen with Bookhushly notifications arriving (after IHG and Viator).
// Cropped at the bottom by its container, so it reads as a phone held up, not a diagram.
export function LockScreenPreview() {
  const still = useMotionTier() === 'none';
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="Example notifications on a lock screen: your ticket is ready, and check-in tomorrow."
      style={{ flex: 1, alignItems: 'center', overflow: 'hidden' }}
    >
      <View
        style={{
          width: PHONE_WIDTH,
          flexGrow: 1,
          // Taller than its space, so the bottom is cut off by the container.
          minHeight: PHONE_WIDTH * 1.4,
          marginBottom: -SCREEN_RADIUS * 2,
          borderRadius: SCREEN_RADIUS + BEZEL,
          borderCurve: 'continuous',
          backgroundColor: color.textPrimary,
          padding: BEZEL,
        }}
      >
        <View
          style={{
            flex: 1,
            borderRadius: SCREEN_RADIUS,
            borderCurve: 'continuous',
            overflow: 'hidden',
          }}
        >
          <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: color.scrim[1] }]} />
          <View style={{ alignItems: 'center', paddingTop: space.s8, gap: space.s1 }}>
            <Text variant="labelSm" tone="onInverse">
              Saturday
            </Text>
            <Text variant="display" tone="onInverse">
              9:41
            </Text>
          </View>
          <View style={{ gap: space.s3, paddingHorizontal: space.s3, marginTop: space.s7 }}>
            {SAMPLES.map((sample, i) => (
              <Animated.View key={sample.title} entering={still ? undefined : arrive(i)}>
                <Notification sample={sample} />
              </Animated.View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}
