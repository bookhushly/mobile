import { TextInput, type TextInputProps } from 'react-native';

import { color, density, radius, space, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

import { Stack } from './Stack';
import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string | undefined };

export function Input({ label, error, ...rest }: Props) {
  const v = typeVariants.body;
  return (
    <Stack gap="s2">
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.textMuted}
        {...rest}
        style={{
          minHeight: density.customer.controlHeight,
          paddingHorizontal: space.s4,
          borderRadius: radius.r3,
          borderWidth: 1,
          borderColor: error ? color.status.danger.solid : color.borderStrong,
          backgroundColor: color.surface,
          color: color.textPrimary,
          fontFamily: fontFamily(v.font, v.weight),
          fontSize: v.size,
        }}
      />
      {error ? (
        <Text variant="bodySm" style={{ color: color.status.danger.solid }}>
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
