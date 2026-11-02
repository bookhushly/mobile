import { ArrowLeft, type LucideIcon } from 'lucide-react-native';
import { useContext, useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaInsetsContext } from 'react-native-safe-area-context';

import { sheetOffset, type SheetBand } from '@/features/auth/domain/authBackdrop';
import { color, layout, motion, radius, space } from '@/shared/theme';
import { IconButton } from '@/shared/ui';
import { useMotionTier } from '@/shared/ui/motion';
import { useWide } from '@/shared/ui/useWide';

type Props = {
  band: SheetBand;
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

const SHOW = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
const HIDE = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
// Clears the leave button's face when the sheet has risen under it.
const LEAVE_CLEARANCE = 56;

// Form screens over AuthBackdrop's photo. The sheet is a full-height layer pushed down with a
// transform, so its lower edge sits off screen by `offset`; the scroll padding gives that back.
export function AuthSheet({
  band,
  children,
  footer,
  onLeave,
  leaveIcon = ArrowLeft,
  leaveLabel = 'Back',
  startRaised = false,
}: Props) {
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0 };
  const tier = useMotionTier();
  const { height: windowHeight } = useWindowDimensions();
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  const [keyboardOpen, setKeyboardOpen] = useState(() => startRaised || Keyboard.isVisible());
  const offset = sheetOffset(band, insets.top, keyboardOpen);
  const still = tier === 'none';
  const y = useSharedValue(still || startRaised ? offset : windowHeight);

  useEffect(() => {
    const show = Keyboard.addListener(SHOW, () => {
      setKeyboardOpen(true);
    });
    const hide = Keyboard.addListener(HIDE, () => {
      setKeyboardOpen(false);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    y.set(still ? offset : withSpring(offset, motion.spring.sheet));
  }, [offset, still, y]);

  const slide = useAnimatedStyle(() => ({ transform: [{ translateY: y.get() }] }));

  return (
    <View style={{ flex: 1 }}>
      {onLeave !== undefined ? (
        // First in the tree so screen readers reach it first; zIndex keeps it over the sheet.
        <View
          testID="auth-leave"
          style={{ position: 'absolute', top: insets.top + space.s2, left: space.s3, zIndex: 1 }}
        >
          <IconButton icon={leaveIcon} accessibilityLabel={leaveLabel} onPress={onLeave} />
        </View>
      ) : null}
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
        <ScrollView
          testID="auth-sheet-scroll"
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{
            paddingHorizontal: gutter,
            paddingTop: keyboardOpen && onLeave !== undefined ? LEAVE_CLEARANCE : space.s6,
            paddingBottom: offset + insets.bottom + space.s5,
            gap: space.s5,
            width: '100%',
            maxWidth: layout.formMaxWidth,
            alignSelf: 'center',
          }}
        >
          {children}
          {footer}
        </ScrollView>
      </Animated.View>
    </View>
  );
}
