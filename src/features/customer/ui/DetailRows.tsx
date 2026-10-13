import { MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';
import { formatNaira, Icon, Money, Text, useDensity } from '@/shared/ui';

export type DetailRow = {
  label: string;
  value: string;
  /** A place: the row opens Maps. */
  onPress?: () => void;
  /** Money shown before the value (the booking total in the Payment row). */
  amount?: number | null;
  /** What a screen reader says for the row, when the default (label, value) isn't right. */
  spoken?: string;
};

type Props = { rows: readonly (DetailRow | null)[]; testID?: string };

// Label over value, one per row (Mobbin §4: calm label/value rows). Empty values are left out.
export function DetailRows({ rows, testID }: Props) {
  const d = useDensity();
  const shown = rows.filter((r): r is DetailRow => r !== null && r.value.trim() !== '');
  return (
    <View testID={testID}>
      {shown.map((r) => {
        const style = {
          minHeight: d.rowMin,
          flexDirection: 'row' as const,
          alignItems: 'center' as const,
          gap: space.s3,
          paddingVertical: space.s3,
          borderBottomWidth: borderWidth.hairline,
          borderBottomColor: color.border,
        };
        const text = (
          <View style={{ flex: 1, gap: space.s1 }}>
            <Text variant="label" tone="textSecondary">
              {r.label}
            </Text>
            {typeof r.amount === 'number' ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s2 }}>
                <Money amount={r.amount} variant="bodyStrong" />
                <Text variant="body" tone="textSecondary">
                  {`· ${r.value}`}
                </Text>
              </View>
            ) : (
              <Text variant="body" tone={r.onPress !== undefined ? 'linkText' : 'textPrimary'}>
                {r.value}
              </Text>
            )}
          </View>
        );
        const spoken =
          r.spoken ??
          (typeof r.amount === 'number'
            ? `${r.label}, ${formatNaira(r.amount)}, ${r.value}`
            : `${r.label}, ${r.value}`);
        if (r.onPress === undefined)
          return (
            <View key={r.label} accessible accessibilityLabel={spoken} style={style}>
              {text}
            </View>
          );
        return (
          <Pressable
            key={r.label}
            accessibilityRole="link"
            accessibilityLabel={spoken}
            accessibilityHint="Opens maps"
            onPress={r.onPress}
            style={({ pressed }) => [
              style,
              { backgroundColor: pressed ? color.wash : 'transparent' },
            ]}
          >
            {text}
            <Icon as={MapPin} size="sm" tone="linkText" />
          </Pressable>
        );
      })}
    </View>
  );
}
