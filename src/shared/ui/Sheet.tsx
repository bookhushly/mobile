import { X } from 'lucide-react-native';
import { useContext, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { borderWidth, color, space } from '@/shared/theme';

import { IconButton } from './IconButton';
import { useMotionTier } from './motion';
import { Text } from './Text';

// Room for a text action on the right ("Clear") and the same on the left, so the title centres.
const SIDE = 88;
const MIN_SIDE = 44;

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  /** Overrides back/swipe-down (defaults to onClose unless closeDisabled). */
  onRequestClose?: () => void;
  /** iOS only: the sheet has finished sliding away (RN Modal `onDismiss`). */
  onDismissed?: () => void;
  right?: ReactNode;
  footer?: ReactNode;
  scroll?: boolean;
  testID?: string;
  children: ReactNode;
};

export function Sheet({
  visible,
  title,
  onClose,
  closeLabel = 'Close',
  closeDisabled = false,
  onRequestClose,
  onDismissed,
  right,
  footer,
  scroll = false,
  testID,
  children,
}: Props) {
  const tier = useMotionTier();
  // With nothing on the right, both sides shrink to the close button so the title gets the room.
  const side = right === undefined ? MIN_SIDE : SIDE;
  // Context, not the hook: the hook throws without a provider, which bare unit renders lack.
  const insets = useContext(SafeAreaInsetsContext) ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const body = { padding: space.s5, gap: space.s4 };
  const requestClose =
    onRequestClose ??
    (() => {
      if (!closeDisabled) onClose();
    });
  return (
    <Modal
      visible={visible}
      animationType={tier === 'none' ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      testID={testID}
      onRequestClose={requestClose}
      onDismiss={onDismissed}
    >
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.surface }}>
        {/* After Skyscanner, Agoda and BlaBlaCar (Mobbin, 2026-11-15): a round close button at the
            left, the title centred, no rule under it; equal side slots keep the title centred. */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s3,
            paddingHorizontal: space.s5,
            paddingTop: space.s4,
            paddingBottom: space.s3,
          }}
        >
          <View style={{ width: side, alignItems: 'flex-start' }}>
            <IconButton
              icon={X}
              accessibilityLabel={closeLabel}
              onPress={onClose}
              disabled={closeDisabled}
            />
          </View>
          <Text
            variant="headline"
            accessibilityRole="header"
            numberOfLines={2}
            style={{ flex: 1, textAlign: 'center' }}
          >
            {title}
          </Text>
          <View style={{ width: side, alignItems: 'flex-end' }}>{right}</View>
        </View>
        {/* The sticky footer must stay above the keyboard: iOS pads; Android resizes the page
            sheet natively, so no behaviour there. */}
        <KeyboardAvoidingView
          testID="sheet-keyboard"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
        >
          {scroll ? (
            <ScrollView
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={body}
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[{ flex: 1 }, body]}>{children}</View>
          )}
          {footer !== undefined ? (
            <View
              style={{
                paddingHorizontal: space.s5,
                paddingTop: space.s3,
                paddingBottom: Math.max(insets.bottom, space.s5),
                gap: space.s3,
                borderTopWidth: borderWidth.hairline,
                borderTopColor: color.border,
                backgroundColor: color.surface,
              }}
            >
              {footer}
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}
