import { MapPin } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { openMaps } from '@/features/customer/ui/links';
import type { ListingSummary } from '@/features/customer/ui/listingSummary';
import { RatingLine } from '@/features/customer/ui/RatingLine';
import { color, space } from '@/shared/theme';
import { Icon, Text, useDensity } from '@/shared/ui';

type Props = {
  summary: ListingSummary;
  /** Events show the venue in their own rows instead. */
  showArea: boolean;
};

// Spec §3 overview: title, area (→ Maps), rating with its review count.
export function ListingOverview({ summary: s, showArea }: Props) {
  const d = useDensity();
  const query = s.mapQuery;
  const area = showArea ? (s.area ?? query) : null;
  return (
    <View style={{ gap: space.s2 }}>
      <Text variant="titleLg" accessibilityRole="header" testID="listing-title">
        {s.title}
      </Text>
      {area !== null && query !== null ? (
        <Pressable
          accessibilityRole="link"
          accessibilityLabel={`${area}, open in maps`}
          onPress={() => {
            openMaps(query);
          }}
          style={({ pressed }) => ({
            minHeight: d.minTarget,
            flexDirection: 'row',
            alignItems: 'center',
            gap: space.s2,
            backgroundColor: pressed ? color.wash : 'transparent',
          })}
        >
          <Icon as={MapPin} size="xs" tone="linkText" />
          <Text variant="bodySm" tone="linkText" numberOfLines={2} style={{ flexShrink: 1 }}>
            {area}
          </Text>
        </Pressable>
      ) : area !== null ? (
        <Text variant="bodySm" tone="textSecondary">
          {area}
        </Text>
      ) : null}
      {s.rating !== null ? <RatingLine avg={s.rating.avg} count={s.rating.count} /> : null}
    </View>
  );
}
