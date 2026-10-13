import { Clock, X } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import type { RecentSearch } from '@/features/customer/offline/recentSearches';
import { CATEGORY_LABEL } from '@/features/customer/ui/discoverLabels';
import { borderWidth, color, space } from '@/shared/theme';
import { Icon, IconButton, Text, useDensity } from '@/shared/ui';

type Props = {
  item: RecentSearch;
  onPress: (e: RecentSearch) => void;
  onRemove: (e: RecentSearch) => void;
  testID?: string;
};

// Marriott-style recent row: the search (with its category) and an × beside it, not inside it,
// so screen readers reach both.
export function RecentSearchRow({ item, onPress, onRemove, testID }: Props) {
  const d = useDensity();
  const category = CATEGORY_LABEL[item.category];
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s2,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.label}, ${category}`}
        onPress={() => {
          onPress(item);
        }}
        style={({ pressed }) => ({
          flex: 1,
          minHeight: d.rowMin,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.s4,
          paddingVertical: space.s3,
          backgroundColor: pressed ? color.wash : 'transparent',
        })}
      >
        <Icon as={Clock} size="sm" tone="textMuted" />
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {item.label}
          </Text>
          <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
            {category}
          </Text>
        </View>
      </Pressable>
      <IconButton
        icon={X}
        accessibilityLabel={`Remove ${item.label} from recent searches`}
        onPress={() => {
          onRemove(item);
        }}
      />
    </View>
  );
}
