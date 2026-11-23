import { Pressable, View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';
import { Text, useDensity } from '@/shared/ui';

type Props<T extends string> = {
  /** The group's spoken name ("Pick-up time"). */
  label: string;
  value: T | null;
  options: readonly { value: T; label: string }[];
  /** Tapping the chosen chip again clears it (every group here is optional). */
  onChange: (v: T | null) => void;
  testID?: string;
};

// Abstract choices stay chips (owner, 2026-11-23); they wrap so every option is in view. Chosen is
// solid ink with white text, as FilterChips: violet stays for the one action on the screen.
export function ChoiceChips<T extends string>({
  label,
  value,
  options,
  onChange,
  testID,
}: Props<T>) {
  const d = useDensity();
  return (
    <View
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: d.targetGap }}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={o.label}
            accessibilityState={{ checked }}
            onPress={() => {
              onChange(checked ? null : o.value);
            }}
            style={{
              minHeight: d.minTarget,
              justifyContent: 'center',
              paddingHorizontal: space.s5,
              borderRadius: radius.rFull,
              backgroundColor: checked ? color.textPrimary : color.surface,
              borderWidth: borderWidth.hairline,
              borderColor: checked ? color.textPrimary : color.borderStrong,
            }}
          >
            <Text variant="label" tone={checked ? 'onInverse' : 'textPrimary'} maxScale={1.3}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
