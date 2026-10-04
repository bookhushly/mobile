import { useState } from 'react';
import { TextInput, type TextInputProps } from 'react-native';

import { color, density, radius, space, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

import { Stack } from './Stack';
import { Text } from './Text';

type Props = TextInputProps & { label: string; error?: string | undefined };

export function Input({ label, error, onFocus, onBlur, ...rest }: Props) {
  const v = typeVariants.body;
  const [focused, setFocused] = useState(false);
  return (
    <Stack gap="s2">
      <Text variant="label">{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={color.textMuted}
        {...rest}
        maxFontSizeMultiplier={v.maxScale}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        style={{
          minHeight: density.customer.controlHeight,
          paddingHorizontal: space.s4,
          borderRadius: radius.r3,
          borderWidth: focused ? 2 : 1,
          borderColor: error
            ? color.status.danger.solid
            : focused
              ? color.actionFill
              : color.borderStrong,
          backgroundColor: color.surface,
          color: color.textPrimary,
          fontFamily: fontFamily(v.font, v.weight),
          fontSize: v.size,
          lineHeight: v.lineHeight,
        }}
      />
      {error ? (
        <Text
          variant="bodySm"
          accessibilityLiveRegion="polite"
          style={{ color: color.status.danger.solid }}
        >
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
