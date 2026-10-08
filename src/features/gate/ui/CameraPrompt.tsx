import { ScrollView, View } from 'react-native';

import { iconSize, space } from '@/shared/theme';
import { Button, Illustration, Text } from '@/shared/ui';

type Props = {
  state: 'ask' | 'denied';
  canAsk: boolean;
  onAllow: () => void;
  onOpenSettings: () => void;
  onEnterByHand: () => void;
};

// Shown before the OS prompt (spec §4.2), and again when access is off.
export function CameraPrompt({ state, canAsk, onAllow, onOpenSettings, onEnterByHand }: Props) {
  const ask = state === 'ask' || canAsk;
  // Scrolls at the largest text sizes so both buttons stay reachable.
  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        justifyContent: 'center',
        padding: space.s6,
        gap: space.s5,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ alignItems: 'center' }}>
        <Illustration name="camera" size={iconSize.xxl} />
      </View>
      <Text variant="titleLg" tone="onInverse" accessibilityRole="header">
        {state === 'ask' ? 'Allow camera to scan tickets' : 'Camera is off for Bookhushly'}
      </Text>
      <Text variant="body" tone="onInverse">
        The camera is only used to read ticket codes. Nothing is recorded.
      </Text>
      <Button
        label={ask ? 'Allow camera' : 'Open settings'}
        onInverse="light"
        onPress={ask ? onAllow : onOpenSettings}
      />
      <Button
        variant="secondary"
        onInverse="light"
        label="Enter codes by hand"
        onPress={onEnterByHand}
      />
    </ScrollView>
  );
}
