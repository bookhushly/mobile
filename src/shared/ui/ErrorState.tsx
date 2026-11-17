import { CircleAlert } from 'lucide-react-native';
import { View } from 'react-native';

import { color, radius, space } from '@/shared/theme';

import { Button } from './Button';
import { Icon } from './Icon';
import { Text } from './Text';

type Props = {
  title: string;
  message?: string;
  /** Whether data/money is safe: shown only when the caller knows, never assumed. */
  safeLine?: string;
  onRetry?: () => void;
  retryLabel?: string;
  testID?: string;
};

const ICON_DISC = 64;

// DESIGN_SYSTEM §6: what happened, whether data is safe (only when known), the next step.
export function ErrorState({
  title,
  message,
  safeLine,
  onRetry,
  retryLabel = 'Try again',
  testID,
}: Props) {
  return (
    <View
      testID={testID}
      style={{ alignItems: 'center', gap: space.s4, paddingVertical: space.s8 }}
    >
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
        <Icon as={CircleAlert} size="lg" tone="textPrimary" />
      </View>
      <Text variant="title" align="center" accessibilityLiveRegion="polite">
        {title}
      </Text>
      {message !== undefined ? (
        <Text variant="body" tone="textSecondary" align="center">
          {message}
        </Text>
      ) : null}
      {safeLine !== undefined ? (
        <Text variant="bodySm" tone="successFg" align="center">
          {safeLine}
        </Text>
      ) : null}
      {onRetry !== undefined ? <Button label={retryLabel} onPress={onRetry} /> : null}
    </View>
  );
}
