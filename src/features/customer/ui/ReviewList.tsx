import { BadgeCheck, Star } from 'lucide-react-native';
import { View } from 'react-native';

import { reviewDate } from '@/features/customer/domain/listingDetail';
import type { Review } from '@/features/customer/schemas/reviews';
import { borderWidth, color, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

/** One review; its text is already plain (cleaned when parsed). */
export function ReviewItem({ r }: { r: Review }) {
  const name = r.customerName?.trim() ?? '';
  const date = r.createdAt === null ? null : reviewDate(r.createdAt);
  const comment = r.comment;
  const response = r.vendorResponse;
  return (
    <View
      testID={`review-${r.id}`}
      style={{
        gap: space.s2,
        paddingVertical: space.s4,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      <View
        accessible
        accessibilityLabel={`Rated ${String(r.rating)} out of 5${name === '' ? '' : ` by ${name}`}`}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}
      >
        <Icon as={Star} size="xs" tone="textSecondary" />
        <Text variant="label" tabular>{`${String(r.rating)}/5`}</Text>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1} style={{ flex: 1 }}>
          {[name === '' ? 'Guest' : name, date].filter((s) => s !== null).join(' · ')}
        </Text>
      </View>
      {r.verified ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
          <Icon as={BadgeCheck} size="xs" tone="successFg" />
          <Text variant="labelSm" tone="successFg">
            Verified stay
          </Text>
        </View>
      ) : null}
      {comment !== null ? <Text variant="body">{comment}</Text> : null}
      {response !== null ? (
        <View style={{ gap: space.s1, paddingLeft: space.s4 }}>
          <Text variant="labelSm" tone="textSecondary">
            Reply from the host
          </Text>
          <Text variant="bodySm" tone="textSecondary">
            {response}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

// D10: reviews as plain text (the comment and the host's reply), newest as the route sends them.
export function ReviewList({ reviews }: { reviews: readonly Review[] }) {
  return (
    <View>
      {reviews.map((r) => (
        <ReviewItem key={r.id} r={r} />
      ))}
    </View>
  );
}
