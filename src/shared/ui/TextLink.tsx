import { Pressable } from 'react-native';

import { density, space } from '@/shared/theme';

import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  /** `sm`: caption-sized, for links inside a caption line (terms, privacy). */
  size?: 'md' | 'sm';
  /** `onInverse`: white, for a link over a photo or dark surface. */
  tone?: 'link' | 'onInverse';
  accessibilityLabel?: string;
  /** Nothing to do right now (e.g. "Mark all as read" with none unread). */
  disabled?: boolean;
  testID?: string;
};

// Inline link; the 44 pt target comes from padding, not from the text itself.
export function TextLink({
  label,
  onPress,
  size = 'md',
  tone = 'link',
  accessibilityLabel,
  disabled = false,
  testID,
}: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={disabled ? { disabled } : undefined}
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: density.customer.minTarget,
        justifyContent: 'center',
        paddingHorizontal: space.s2,
      }}
    >
      <Text
        variant={size === 'sm' ? 'labelSm' : 'label'}
        tone={disabled ? 'textMuted' : tone === 'onInverse' ? 'onInverse' : 'linkText'}
        // White on a photo has no colour cue left to mark it as a link.
        style={tone === 'onInverse' ? { textDecorationLine: 'underline' } : undefined}
      >
        {label}
      </Text>
    </Pressable>
  );
}
