import { Star } from 'lucide-react-native';
import { View } from 'react-native';

import { ratingLabel } from '@/features/customer/domain/discover';
import { space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

type Props = { avg: number | null; count: number | null; testID?: string };

/** "Rated 4.6 out of 5, 23 reviews"; null without reviews. */
export function ratingSpoken(avg: number | null, count: number | null): string | null {
  if (ratingLabel(avg, count) === null || avg === null || count === null) return null;
  return `Rated ${avg.toFixed(1)} out of 5, ${String(count)} ${count === 1 ? 'review' : 'reviews'}`;
}

// D10: "4.6 (23)" only when there are reviews; nothing otherwise.
export function RatingLine({ avg, count, testID }: Props) {
  const label = ratingLabel(avg, count);
  const spoken = ratingSpoken(avg, count);
  if (label === null || spoken === null) return null;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={spoken}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}
    >
      <Icon as={Star} size="xs" tone="textSecondary" />
      <Text variant="bodySm" tone="textSecondary" tabular>
        {label}
      </Text>
    </View>
  );
}
