import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';
import { Button, Icon, Screen, Text } from '@/shared/ui';

type Props = {
  icon: LucideIcon;
  title: string;
  message: string;
  /** Null when the place it opens isn't available on this account (the message says why). */
  action: { label: string; onPress: () => void } | null;
  testID?: string;
};

/**
 * A tab whose work happens in another part of the app (Scan → gate mode, Rooms → front desk): it
 * says what lives there and opens it, rather than copying those screens.
 */
export function HandOffScreen({ icon, title, message, action, testID }: Props) {
  return (
    <Screen
      footer={
        action === null ? undefined : (
          <Button label={action.label} onPress={action.onPress} testID={testID} />
        )
      }
    >
      <View style={{ gap: space.s4, paddingTop: space.s8 }}>
        <Icon as={icon} size="lg" />
        <Text variant="titleLg" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="body" tone="textSecondary">
          {message}
        </Text>
      </View>
    </Screen>
  );
}
