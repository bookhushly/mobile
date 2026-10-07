import { ActivityIndicator, Pressable } from 'react-native';

import { color, density, radius, space } from '@/shared/theme';

import { Text } from './Text';

type Props = {
  label: string;
  /** Screen-reader label when several buttons share a visible label (defaults to label). */
  accessibilityLabel?: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
  testID?: string;
};

export function Button({
  label,
  accessibilityLabel,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  testID,
}: Props) {
  const inactive = disabled === true || loading === true;
  const primary = variant === 'primary';
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: inactive, busy: loading === true }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: density.customer.controlHeight,
        paddingHorizontal: space.s5,
        borderRadius: radius.r3,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: primary
          ? pressed
            ? color.actionPressed
            : color.actionFill
          : color.surface,
        borderWidth: primary ? 0 : 1,
        borderColor: color.borderStrong,
        opacity: inactive ? 0.5 : 1,
      })}
    >
      {loading ? (
        <ActivityIndicator color={primary ? color.onAction : color.textPrimary} />
      ) : (
        <Text variant="bodyStrong" tone={primary ? 'onAction' : 'textPrimary'}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}
