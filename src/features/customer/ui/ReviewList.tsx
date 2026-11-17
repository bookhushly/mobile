import { BadgeCheck } from 'lucide-react-native';
import { View } from 'react-native';

import { ratingWord } from '@/features/customer/domain/discover';
import { reviewDate } from '@/features/customer/domain/listingDetail';
import type { Review } from '@/features/customer/schemas/reviews';
import { borderWidth, color, radius, space, typeVariants } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

/** A review card's width in the listing's row (Expedia: about three quarters of a phone). */
export const REVIEW_CARD_WIDTH = 296;
const COMMENT_LINES = 4;

const heading = (r: Review) => {
  const word = ratingWord(r.rating, 1);
  return `${String(r.rating)}/5${word === null ? '' : ` ${word}`}`;
};
const byline = (r: Review) => {
  const name = r.customerName?.trim() ?? '';
  const date = r.createdAt === null ? null : reviewDate(r.createdAt);
  return [name === '' ? 'Guest' : name, date].filter((s) => s !== null).join(' · ');
};
const spoken = (r: Review) => {
  const name = r.customerName?.trim() ?? '';
  return `Rated ${String(r.rating)} out of 5${name === '' ? '' : ` by ${name}`}`;
};

function Verified() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}>
      <Icon as={BadgeCheck} size="xs" tone="successFg" />
      <Text variant="labelSm" tone="successFg">
        Verified stay
      </Text>
    </View>
  );
}

/**
 * Expedia's review card (owner's pick, 2026-11-15): "5/5 Exceptional" on top, the comment cut to
 * four lines, the name and date at the foot. Cards in the row share one height.
 */
export function ReviewCard({ r }: { r: Review }) {
  return (
    <View
      testID={`review-${r.id}`}
      style={{
        width: REVIEW_CARD_WIDTH,
        minHeight:
          typeVariants.bodyStrong.lineHeight +
          typeVariants.body.lineHeight * COMMENT_LINES +
          typeVariants.bodySm.lineHeight * 2 +
          space.s3 * 3,
        gap: space.s3,
        padding: space.s5,
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
      }}
    >
      <View accessible accessibilityLabel={spoken(r)}>
        <Text variant="bodyStrong" tabular>
          {heading(r)}
        </Text>
      </View>
      {r.comment !== null ? (
        <Text variant="body" numberOfLines={COMMENT_LINES}>
          {r.comment}
        </Text>
      ) : null}
      <View style={{ marginTop: 'auto', gap: space.s1 }}>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
          {byline(r)}
        </Text>
        {r.verified ? <Verified /> : null}
      </View>
    </View>
  );
}

/**
 * One review in the full list (Vrbo's "Guest reviews"): the score and word as a heading, who and
 * when, the whole comment, and the host's reply set apart on a wash.
 */
export function ReviewItem({ r }: { r: Review }) {
  const response = r.vendorResponse;
  return (
    <View
      testID={`review-${r.id}`}
      style={{
        gap: space.s3,
        paddingVertical: space.s6,
        borderBottomWidth: borderWidth.hairline,
        borderBottomColor: color.border,
      }}
    >
      <View accessible accessibilityLabel={spoken(r)} style={{ gap: space.s1 }}>
        <Text variant="headline" tabular>
          {heading(r)}
        </Text>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
          {byline(r)}
        </Text>
      </View>
      {r.verified ? <Verified /> : null}
      {r.comment !== null ? <Text variant="body">{r.comment}</Text> : null}
      {response !== null ? (
        <View
          style={{
            gap: space.s2,
            padding: space.s4,
            borderRadius: radius.r3,
            backgroundColor: color.wash,
          }}
        >
          <Text variant="label">Reply from the host</Text>
          <Text variant="bodySm" tone="textSecondary">
            {response}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
