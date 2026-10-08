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
  error?: string;
  testID?: string;
};

// One real input (screen readers and autofill see a single secure field); the boxes are visual.
export function PinField({ label, value, onChangeText, length = 6, error, testID }: Props) {
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
              {i < value.length ? <Text variant="title">•</Text> : null}
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
          onChangeText(t.replace(/\D/g, '').slice(0, length));
        }}
        keyboardType="number-pad"
        secureTextEntry
        maxLength={length}
        autoComplete="off"
        textContentType="none"
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
