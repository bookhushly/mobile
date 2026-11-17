import { View } from 'react-native';

import { ratingLabel, ratingWord } from '@/features/customer/domain/discover';
import { color, radius, space } from '@/shared/theme';
import { Text } from '@/shared/ui';

type Props = {
  avg: number | null;
  count: number | null;
  /** Narrow cards: the score and its word only ("4.6 Excellent"); the count is still spoken. */
  compact?: boolean;
  testID?: string;
};

/** "Rated 4.6 out of 5, 23 reviews"; null without reviews. */
export function ratingSpoken(avg: number | null, count: number | null): string | null {
  if (ratingLabel(avg, count) === null || avg === null || count === null) return null;
  return `Rated ${avg.toFixed(1)} out of 5, ${String(count)} ${count === 1 ? 'review' : 'reviews'}`;
}

// D10, restyled after Expedia (2026-11-14): the score in a green badge, its word, then the count.
// Nothing at all without reviews.
export function RatingLine({ avg, count, compact = false, testID }: Props) {
  const spoken = ratingSpoken(avg, count);
  if (spoken === null || avg === null || count === null) return null;
  const word = ratingWord(avg, count);
  const reviews = `${String(count)} ${count === 1 ? 'review' : 'reviews'}`;
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={spoken}
      style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}
    >
      <View
        style={{
          paddingHorizontal: space.s3,
          paddingVertical: space.s1,
          borderRadius: radius.r1,
          backgroundColor: color.accent.rating.bg,
        }}
      >
        <Text variant="labelSm" tabular maxScale={1.3} style={{ color: color.accent.rating.fg }}>
          {avg.toFixed(1)}
        </Text>
      </View>
      <Text variant="bodySm" numberOfLines={1} style={{ flexShrink: 1 }}>
        {word !== null ? <Text variant="label">{compact ? word : `${word} `}</Text> : null}
        {compact && word !== null ? null : (
          <Text variant="bodySm" tone="textSecondary" tabular>
            {word !== null ? `· ${reviews}` : reviews}
          </Text>
        )}
      </Text>
    </View>
  );
}
