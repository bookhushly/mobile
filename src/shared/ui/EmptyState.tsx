import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius, space } from '@/shared/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Illustration, type IllustrationName } from './Illustration';
import { Text } from './Text';

type Props = {
  illustration?: IllustrationName;
  icon?: LucideIcon | undefined;
  title: string;
  /** For a screen with no other heading: screen readers can jump to the title. */
  titleRole?: 'header';
  message?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
};

const ICON_DISC = 64;

// DESIGN_SYSTEM §6: icon (or illustration) + reason + one action.
export function EmptyState({
  illustration,
  icon,
  title,
  titleRole,
  message,
  action,
  testID,
}: Props) {
  return (
    <View
      testID={testID}
      style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s9 }}
    >
      {illustration !== undefined ? (
        <Illustration name={illustration} size={128} />
      ) : icon !== undefined ? (
        // The icon sits in a soft circle (Expedia's empty Trips): a quiet focal point, not a glyph
        // floating on white.
        <View
          style={{
            width: ICON_DISC,
            height: ICON_DISC,
            borderRadius: radius.rFull,
            backgroundColor: color.wash,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: space.s2,
          }}
        >
          <Icon as={icon} size="lg" tone="textPrimary" />
        </View>
      ) : null}
      <Text
        variant="title"
        align="center"
        accessibilityRole={titleRole}
        accessibilityLiveRegion="polite"
      >
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
