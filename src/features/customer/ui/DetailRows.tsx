import { MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { borderWidth, color, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

export type DetailRow = {
  label: string;
  value: string;
  /** A place: the row opens Maps. */
  onPress?: () => void;
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
            <Text variant="body" tone={r.onPress !== undefined ? 'linkText' : 'textPrimary'}>
              {r.value}
            </Text>
          </View>
        );
        if (r.onPress === undefined)
          return (
            <View
              key={r.label}
              accessible
              accessibilityLabel={`${r.label}, ${r.value}`}
              style={style}
            >
              {text}
            </View>
          );
        return (
          <Pressable
            key={r.label}
            accessibilityRole="link"
            accessibilityLabel={`${r.label}, ${r.value}`}
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
