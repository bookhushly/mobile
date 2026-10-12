import { ScrollView, View } from 'react-native';

import { iconSize, space } from '@/shared/theme';
import { Button, Illustration, Text } from '@/shared/ui';

type Props = {
  state: 'ask' | 'denied';
  canAsk: boolean;
  askTitle: string;
  body: string;
  byHandLabel: string;
  // inverse: dark scanner backdrop (gate). default: light surfaces (front desk).
  tone?: 'inverse' | 'default';
  onAllow: () => void;
  onOpenSettings: () => void;
  onEnterByHand: () => void;
};

// Shown before the OS prompt, and again when access is off.
export function CameraPrompt({
  state,
  canAsk,
  askTitle,
  body,
  byHandLabel,
  tone = 'default',
  onAllow,
  onOpenSettings,
  onEnterByHand,
}: Props) {
  const ask = state === 'ask' || canAsk;
  const inverse = tone === 'inverse';
  const onInverse = inverse ? 'light' : undefined;
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
      <Text
        variant="titleLg"
        tone={inverse ? 'onInverse' : 'textPrimary'}
        accessibilityRole="header"
      >
        {state === 'ask' ? askTitle : 'Camera is off for Bookhushly'}
      </Text>
      <Text variant="body" tone={inverse ? 'onInverse' : 'textSecondary'}>
        {body}
      </Text>
      <Button
        label={ask ? 'Allow camera' : 'Open settings'}
        onInverse={onInverse}
        onPress={ask ? onAllow : onOpenSettings}
      />
      <Button
        variant="secondary"
        onInverse={onInverse}
        label={byHandLabel}
        onPress={onEnterByHand}
      />
    </ScrollView>
  );
}
