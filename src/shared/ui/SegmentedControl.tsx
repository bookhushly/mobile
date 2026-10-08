import { Pressable, View } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string; count?: number };
type Props<T extends string> = {
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  testID?: string;
};

const nameOf = <T extends string>(o: Option<T>) =>
  o.count === undefined ? o.label : `${o.label} (${String(o.count)})`;

export function SegmentedControl<T extends string>({ value, options, onChange, testID }: Props<T>) {
  const d = useDensity();
  return (
    <View
      testID={testID}
      accessibilityRole="tablist"
      style={{
        flexDirection: 'row',
        backgroundColor: color.wash,
        borderRadius: radius.r3,
        padding: space.s1,
        gap: space.s1,
      }}
    >
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityLabel={nameOf(o)}
            accessibilityState={{ selected }}
            onPress={() => {
              onChange(o.value);
            }}
            style={{
              flex: 1,
              minHeight: d.minTarget,
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: space.s2,
              borderRadius: radius.r2,
              backgroundColor: selected ? color.surface : 'transparent',
              borderWidth: borderWidth.hairline,
              borderColor: selected ? color.border : 'transparent',
            }}
          >
            <Text
              variant="label"
              tone={selected ? 'textPrimary' : 'textSecondary'}
              numberOfLines={2}
              align="center"
              maxScale={1.3}
            >
              {nameOf(o)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
