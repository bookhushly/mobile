import { useContext, type ReactNode } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaInsetsContext, SafeAreaView } from 'react-native-safe-area-context';

import { borderWidth, color, space } from '@/shared/theme';

import { Button } from './Button';
import { useMotionTier } from './motion';
import { Text } from './Text';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  closeLabel?: string;
  closeDisabled?: boolean;
  /** Overrides back/swipe-down (defaults to onClose unless closeDisabled). */
  onRequestClose?: () => void;
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
  right,
  footer,
  scroll = false,
  testID,
  children,
}: Props) {
  const tier = useMotionTier();
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
    >
      <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: color.surface }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s3,
            paddingHorizontal: space.s3,
            minHeight: 56,
            borderBottomWidth: borderWidth.hairline,
            borderBottomColor: color.border,
          }}
        >
          <View style={{ minWidth: 88 }}>
            <Button variant="ghost" label={closeLabel} onPress={onClose} disabled={closeDisabled} />
          </View>
          <Text variant="headline" accessibilityRole="header" numberOfLines={1} style={{ flex: 1 }}>
            {title}
          </Text>
          <View style={{ minWidth: 88, alignItems: 'flex-end' }}>{right}</View>
        </View>
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
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
      </SafeAreaView>
    </Modal>
  );
}
