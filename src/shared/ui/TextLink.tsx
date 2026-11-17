import { Pressable } from 'react-native';

import { density, space } from '@/shared/theme';

import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  /** `sm`: caption-sized. `lg`: body-sized, for a standalone link beside buttons or body text. */
  size?: 'sm' | 'md' | 'lg';
  /** Inside a line of text: no side padding, so it spaces like a word; the target widens via hitSlop. */
  inline?: boolean;
  /** `onInverse`: white, for a link over a photo or dark surface. */
  tone?: 'link' | 'onInverse';
  accessibilityLabel?: string;
  /** Nothing to do right now (e.g. "Mark all as read" with none unread). */
  disabled?: boolean;
  testID?: string;
};

const VARIANT = { sm: 'labelSm', md: 'label', lg: 'linkLg' } as const;

// Inline link; the 44 pt target comes from padding, not from the text itself.
export function TextLink({
  label,
  onPress,
  size = 'md',
  inline = false,
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
      hitSlop={inline ? { left: space.s2, right: space.s2 } : undefined}
      style={{
        minHeight: density.customer.minTarget,
        justifyContent: 'center',
        paddingHorizontal: inline ? 0 : space.s2,
      }}
    >
      <Text
        variant={VARIANT[size]}
        tone={disabled ? 'textMuted' : tone === 'onInverse' ? 'onInverse' : 'linkText'}
        // Links share the text colour, so the underline is what marks them as links.
        style={{ textDecorationLine: 'underline' }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
