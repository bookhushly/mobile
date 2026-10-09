import { Pressable } from 'react-native';

import { density, space } from '@/shared/theme';

import { Text } from './Text';

type Props = {
  label: string;
  onPress: () => void;
  /** `sm`: caption-sized, for links inside a caption line (terms, privacy). */
  size?: 'md' | 'sm';
  accessibilityLabel?: string;
  testID?: string;
};

// Inline link; the 44 pt target comes from padding, not from the text itself.
export function TextLink({ label, onPress, size = 'md', accessibilityLabel, testID }: Props) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="link"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      style={{
        minHeight: density.customer.minTarget,
        justifyContent: 'center',
        paddingHorizontal: space.s2,
      }}
    >
      <Text variant={size === 'sm' ? 'labelSm' : 'label'} tone="linkText">
        {label}
      </Text>
    </Pressable>
  );
}
