import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { space } from '@/shared/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Illustration, type IllustrationName } from './Illustration';
import { Text } from './Text';

type Props = {
  illustration?: IllustrationName;
  icon?: LucideIcon | undefined;
  title: string;
  message?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
};

// DESIGN_SYSTEM §6: icon (or illustration) + reason + one action.
export function EmptyState({ illustration, icon, title, message, action, testID }: Props) {
  return (
    <View
      testID={testID}
      style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s9 }}
    >
      {illustration !== undefined ? (
        <Illustration name={illustration} size={128} />
      ) : icon !== undefined ? (
        <Icon as={icon} size="lg" tone="textMuted" />
      ) : null}
      <Text variant="headline" align="center" accessibilityLiveRegion="polite">
        {title}
      </Text>
      {message !== undefined ? (
        <Text variant="body" tone="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {action !== undefined ? (
        <Button variant="secondary" label={action.label} onPress={action.onPress} />
      ) : null}
    </View>
  );
}
