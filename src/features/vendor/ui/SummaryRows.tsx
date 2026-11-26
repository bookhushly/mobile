import { ChevronRight } from 'lucide-react-native';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { borderWidth, color, largeTextScale, pressedOpacity, radius, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

export type SummaryRow = {
  label: string;
  /** The detail under the label; it ends in "…" rather than wrapping. */
  detail: string;
  value: string;
  onPress: () => void;
  testID?: string;
};

/**
 * Today's "what needs you": full-width rows, no icons, label and value never wrap (design v5,
 * Jobber's business health). Each row is one tap.
 */
export function SummaryRows({ rows }: { rows: SummaryRow[] }) {
  // Large text: the value moves under the label, so neither is ever cut off.
  const stacked = useWindowDimensions().fontScale >= largeTextScale;
  return (
    <View
      style={{ backgroundColor: color.wash, borderRadius: radius.r4, paddingHorizontal: space.s5 }}
    >
      {rows.map((r, i) => (
        <Pressable
          key={r.label}
          testID={r.testID}
          accessibilityRole="button"
          accessibilityLabel={`${r.label}, ${r.value}${r.detail === '' ? '' : `. ${r.detail}`}`}
          onPress={r.onPress}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s4,
            paddingVertical: space.s5,
            borderTopWidth: i === 0 ? 0 : borderWidth.hairline,
            borderTopColor: color.border,
            opacity: pressed ? pressedOpacity : 1,
          })}
        >
          <View style={{ flex: 1, minWidth: 0, gap: space.s1 }}>
            <Text variant="label" numberOfLines={1}>
              {r.label}
            </Text>
            {r.detail === '' ? null : (
              <Text variant="caption" tone="textSecondary" numberOfLines={1}>
                {r.detail}
              </Text>
            )}
            {stacked ? (
              <Text variant="title" tabular>
                {r.value}
              </Text>
            ) : null}
          </View>
          {stacked ? null : (
            <Text variant="title" tabular numberOfLines={1}>
              {r.value}
            </Text>
          )}
          <Icon as={ChevronRight} size="sm" tone="textMuted" />
        </Pressable>
      ))}
    </View>
  );
}
