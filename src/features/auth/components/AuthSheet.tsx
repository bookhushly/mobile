import { Image } from 'expo-image';
import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { anotherSheetIsUp, holdSheet, isOnlySheet } from '@/features/auth/components/sheetPresence';
import { sheetTop } from '@/features/auth/domain/authBackdrop';
import { color, density, layout, motion, radius, space } from '@/shared/theme';
import { IconButton } from '@/shared/ui';
import { useMotionTier } from '@/shared/ui/motion';
import { useWide } from '@/shared/ui/useWide';

// Inside the flow the mark alone is enough (Nike, Eventbrite, Meetup); the full lockup is kept
// for the brand moments, the opening screen and Welcome. Tinted to the text colour.
const mark = require('../../../../assets/images/brand-mark-white.png') as number;
// Left-aligned above the headline, as Nike, IHG and Eventbrite place theirs: part of the page,
// not a nav-bar ornament.
const MARK_PT = 40;

const [s1, s2, s3, s4] = motion.easing.sheet;
const SHEET_EASE = Easing.bezier(s1, s2, s3, s4);
const RISE = { duration: motion.duration.sheet, easing: SHEET_EASE };
// Leaving is quicker than arriving: the person has already decided.
const FALL = { duration: motion.duration.moderate, easing: SHEET_EASE };
const SWAP = { duration: motion.duration.base, easing: SHEET_EASE };

type Props = {
  children: ReactNode;
  /** Scrolls with the form, under the fields. */
  footer?: ReactNode;
  onLeave?: () => void;
  leaveIcon?: LucideIcon;
  leaveLabel?: string;
  /**
   * The screen focuses a field on arrival. Sliding in would put that field under the incoming
   * keyboard for a moment, and iOS would scroll the form away to reveal it.
   */
  startRaised?: boolean;
};

// Form screens: a plain white sheet over the dimmed Welcome photo, which shows only as a sliver
// at the top (the iOS page-sheet look used by Airbnb, Expedia and StubHub). The logo heads every
// form so the brand carries through the whole flow.
export function AuthSheet({
  children,
  footer,
  onLeave,
  leaveIcon = ArrowLeft,
  leaveLabel = 'Back',
  startRaised = false,
}: Props) {
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  const still = useMotionTier() === 'none';
  const { height: windowHeight } = useWindowDimensions();
  const gutter = useWide() ? layout.tabletGutter : layout.formGutter;
  const top = sheetTop(insets.top);
  // Over another sheet: already in place, and only the content fades in.
  const [swapping] = useState(anotherSheetIsUp);
  const y = useSharedValue(still || startRaised || swapping ? top : windowHeight);
  const content = useSharedValue(swapping && !still ? 0 : 1);

  useEffect(holdSheet, []);
  useEffect(() => {
    y.set(still ? top : withTiming(top, RISE));
  }, [top, still, y]);
  useEffect(() => {
    if (!still) content.set(withTiming(1, SWAP));
  }, [still, content]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));
  const fade = useAnimatedStyle(() => ({ opacity: content.get() }));

  // Back to Welcome: the sheet slides away first, then the route changes, so the photo is
  // uncovered rather than cut to. Between sheets it just goes back.
  function leave() {
    if (onLeave === undefined) return;
    if (still || !isOnlySheet()) {
      onLeave();
      return;
    }
    y.set(
      withTiming(windowHeight, FALL, (finished) => {
        if (finished === true) scheduleOnRN(onLeave);
      }),
    );
  }

  return (
    <Animated.View
      testID="auth-sheet"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: color.surface,
          borderTopLeftRadius: radius.r4,
          borderTopRightRadius: radius.r4,
          borderCurve: 'continuous',
        },
        slide,
      ]}
    >
      <Animated.View testID="auth-sheet-content" style={[{ flex: 1 }, fade]}>
        {/* The back button has the row to itself; the logo heads the page below it. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            minHeight: density.customer.minTarget,
            marginTop: space.s3,
            // Same margin as the form, so the back button lines up with the headline.
            paddingHorizontal: gutter,
          }}
        >
          {onLeave !== undefined ? (
            <View testID="auth-leave" style={{ zIndex: 1 }}>
              <IconButton icon={leaveIcon} accessibilityLabel={leaveLabel} onPress={leave} />
            </View>
          ) : null}
        </View>
        <ScrollView
          testID="auth-sheet-scroll"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: space.s5,
            // The sheet is pushed down by `top`, so its lower edge sits off screen by that much.
            paddingBottom: top + insets.bottom + space.s5,
            // Groups (logo, heading, fields, links, legal) sit 32 apart, Airbnb's section rhythm.
            gap: space.s8,
            width: '100%',
            maxWidth: layout.formMaxWidth,
            alignSelf: 'center',
          }}
        >
          {/* Decoration: the headline says where you are, so the mark isn't a screen-reader stop. */}
          <View
            testID="auth-sheet-logo-wrap"
            // The mark belongs with the headline: 20 below it, not the 32 between sections.
            style={{ marginBottom: space.s6 - space.s8 }}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          >
            <Image
              testID="auth-sheet-logo"
              source={mark}
              style={{ width: MARK_PT, height: MARK_PT }}
              contentFit="contain"
              // The logo is violet on light surfaces, white on violet or photos, never black
              // (owner, 2026-11-23: the ink mark here read as a different logo).
              tintColor={color.brand}
            />
          </View>
          {children}
          {footer}
        </ScrollView>
      </Animated.View>
    </Animated.View>
  );
}
