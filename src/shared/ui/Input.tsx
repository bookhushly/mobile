import { useState, type ReactNode } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { borderWidth, color, radius, space, typeVariants } from '@/shared/theme';
import { fontFamily } from '@/shared/theme/fonts';

import { useDensity } from './DensityProvider';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = TextInputProps & {
  label: string;
  error?: string | undefined;
  hint?: string;
  /** Leading slot (search glyph). */
  left?: ReactNode;
  /** Trailing slot (clear, password reveal). */
  right?: ReactNode;
};

export function Input({ label, error, hint, left, right, onFocus, onBlur, style, ...rest }: Props) {
  const v = typeVariants.body;
  const d = useDensity();
  const [focused, setFocused] = useState(false);
  const border = error ? color.status.danger.solid : focused ? color.actionFill : color.borderStrong;
  return (
    <Stack gap="s2">
      <Text variant="label">{label}</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          borderRadius: radius.r3,
          borderCurve: 'continuous',
          borderWidth: focused || error ? borderWidth.thick : borderWidth.hairline,
          borderColor: border,
          backgroundColor: color.surface,
          paddingHorizontal: space.s4,
          gap: space.s3,
        }}
      >
        {left}
        <TextInput
          accessibilityLabel={label}
          accessibilityHint={error ?? hint}
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
          style={[
            {
              flex: 1,
              minHeight: d.controlHeight,
              color: color.textPrimary,
              fontFamily: fontFamily(v.font, v.weight),
              fontSize: v.size,
              lineHeight: v.lineHeight,
            },
            style,
          ]}
        />
        {right}
      </View>
      {error ? (
        <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : hint !== undefined ? (
        <Text variant="bodySm" tone="textMuted">
          {hint}
        </Text>
      ) : null}
    </Stack>
  );
}
