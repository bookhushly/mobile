import { useRef } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Stack } from './Stack';
import { Text } from './Text';

type Props = {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  length?: number;
  error?: string | undefined;
  autoFocus?: boolean;
  testID?: string;
};

// Like PinField but the digits stay visible and the one real input advertises itself as a
// one-time code so iOS/Android autofill from SMS and email can drop the code straight in.
export function CodeField({
  label,
  value,
  onChangeText,
  length = 6,
  error,
  autoFocus,
  testID,
}: Props) {
  const d = useDensity();
  const ref = useRef<TextInput>(null);
  return (
    <Stack gap="s2">
      <Text variant="label">{label}</Text>
      <Pressable
        accessible={false}
        onPress={() => ref.current?.focus()}
        style={{ flexDirection: 'row', gap: space.s3 }}
      >
        {Array.from({ length }, (_, i) => {
          const active = i === value.length;
          const digit = value[i];
          return (
            <View
              key={i}
              importantForAccessibility="no-hide-descendants"
              accessibilityElementsHidden
              style={{
                flex: 1,
                minHeight: d.controlHeight,
                borderRadius: radius.r3,
                borderCurve: 'continuous',
                borderWidth: active ? borderWidth.thick : borderWidth.hairline,
                borderColor: error
                  ? color.status.danger.solid
                  : active
                    ? color.actionFill
                    : color.borderStrong,
                backgroundColor: color.surface,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {digit !== undefined ? (
                <Text variant="title" tabular>
                  {digit}
                </Text>
              ) : null}
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={ref}
        testID={testID}
        accessibilityLabel={label}
        accessibilityHint={error}
        value={value}
        onChangeText={(t) => {
          // Pasted and autofilled codes arrive with spaces or a trailing newline.
          onChangeText(t.replace(/\D/g, '').slice(0, length));
        }}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        autoFocus={autoFocus}
        caretHidden
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
      />
      {error ? (
        <Text variant="bodySm" tone="dangerFg" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
    </Stack>
  );
}
