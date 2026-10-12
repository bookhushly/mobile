import { Pressable, ScrollView } from 'react-native';

import { borderWidth, color, radius, space } from '@/shared/theme';

import { useDensity } from './DensityProvider';
import { Text } from './Text';

type Option<T extends string> = { value: T; label: string; count?: number };
type Props<T extends string> = {
  /** The group's spoken name (e.g. "Room status"). */
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (v: T) => void;
  testID?: string;
};

const nameOf = <T extends string>(o: Option<T>) =>
  o.count === undefined ? o.label : `${o.label} ${String(o.count)}`;

// Single-choice filters that may outnumber the screen width: a horizontal row of chips. Unlike
// SegmentedControl (which shares the width), each chip keeps its own size and the row scrolls.
export function FilterChips<T extends string>({
  label,
  value,
  options,
  onChange,
  testID,
}: Props<T>) {
  const d = useDensity();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      testID={testID}
      accessibilityRole="radiogroup"
      accessibilityLabel={label}
      style={{ flexGrow: 0 }}
      // The density's target gap (≥ 8 pt) between adjacent chips, so a tap lands on the one meant.
      contentContainerStyle={{ gap: d.targetGap }}
    >
      {options.map((o) => {
        const checked = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="radio"
            accessibilityLabel={nameOf(o)}
            accessibilityState={{ checked }}
            onPress={() => {
              onChange(o.value);
            }}
            style={{
              minHeight: d.minTarget,
              justifyContent: 'center',
              paddingHorizontal: space.s3,
              borderRadius: radius.r2,
              // DESIGN_SYSTEM §6/§7: a selected chip is wash + violet; the heavier border keeps the
              // state visible without relying on hue alone.
              backgroundColor: checked ? color.wash : color.surface,
              borderWidth: checked ? borderWidth.thick : borderWidth.hairline,
              borderColor: checked ? color.actionPressed : color.border,
            }}
          >
            <Text
              variant="label"
              tone={checked ? 'linkText' : 'textPrimary'}
              numberOfLines={1}
              maxScale={1.3}
              tabular
            >
              {nameOf(o)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
