import { Star } from 'lucide-react-native';
import { View } from 'react-native';

import { ratingWord } from '@/features/customer/domain/discover';
import { ratingSpoken } from '@/features/customer/ui/RatingLine';
import { borderWidth, color, iconSize, layout, radius, space } from '@/shared/theme';
import { Text, useWide } from '@/shared/ui';

/** How far the sheet rides up over the photo; the photo's counter sits above it. */
export const SHEET_OVERLAP = space.s7;

type Props = {
  title: string;
  /** "Hotel in Lekki, Lagos". */
  kindLine: string;
  /** Apartments: "4 guests · 2 bedrooms · 1 bathroom". */
  specs: string | null;
  rating: { avg: number; count: number } | null;
};

function Stars({ avg }: { avg: number }) {
  const full = Math.round(avg);
  return (
    <View style={{ flexDirection: 'row', gap: space.s1 }}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          size={iconSize.xs - 4}
          strokeWidth={1.5}
          color={color.textPrimary}
          fill={i < full ? color.textPrimary : 'transparent'}
        />
      ))}
    </View>
  );
}

const column = { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.s1 } as const;
const divider = {
  width: borderWidth.hairline,
  alignSelf: 'stretch',
  backgroundColor: color.border,
} as const;

/**
 * Airbnb's listing top (owner's pick, 2026-11-15, Mobbin "Menlo Park Studio"): a white sheet with
 * rounded corners rides up over the photo; the name centred and large, the kind and place under it,
 * then the score with its stars, its word and the review count between hairlines.
 */
export function StayOverview({ title, kindLine, specs, rating }: Props) {
  const gutter = useWide() ? layout.tabletGutter : layout.phoneGutter;
  const word = rating === null ? null : ratingWord(rating.avg, rating.count);
  return (
    <View
      style={{
        // The page's gap sits between the photo and this sheet; the sheet takes it back and rides
        // up over the photo's foot.
        marginTop: -(space.s5 + SHEET_OVERLAP),
        marginHorizontal: -gutter,
        paddingTop: space.s7,
        paddingHorizontal: gutter,
        borderTopLeftRadius: radius.r4,
        borderTopRightRadius: radius.r4,
        borderCurve: 'continuous',
        backgroundColor: color.surface,
        alignItems: 'center',
        gap: space.s2,
      }}
    >
      <Text variant="titleLg" align="center" accessibilityRole="header" testID="listing-title">
        {title}
      </Text>
      <Text variant="body" tone="textSecondary" align="center" testID="listing-kind">
        {kindLine}
      </Text>
      {specs !== null ? (
        <Text variant="bodySm" tone="textSecondary" align="center" testID="listing-specs">
          {specs}
        </Text>
      ) : null}
      {rating !== null ? (
        <View
          accessible
          accessibilityLabel={ratingSpoken(rating.avg, rating.count) ?? undefined}
          testID="listing-rating"
          style={{
            alignSelf: 'stretch',
            flexDirection: 'row',
            marginTop: space.s5,
            paddingVertical: space.s5,
            borderTopWidth: borderWidth.hairline,
            borderBottomWidth: borderWidth.hairline,
            borderColor: color.border,
          }}
        >
          <View style={column}>
            <Text variant="headline" tabular>
              {rating.avg.toFixed(1)}
            </Text>
            <Stars avg={rating.avg} />
          </View>
          {word !== null ? (
            <>
              <View style={divider} />
              <View style={column}>
                <Text variant="label" align="center" numberOfLines={2}>
                  {word}
                </Text>
              </View>
            </>
          ) : null}
          <View style={divider} />
          <View style={column}>
            <Text variant="headline" tabular>
              {String(rating.count)}
            </Text>
            <Text variant="labelSm">{rating.count === 1 ? 'Review' : 'Reviews'}</Text>
          </View>
        </View>
      ) : (
        <View
          style={{
            alignSelf: 'stretch',
            marginTop: space.s4,
            height: borderWidth.hairline,
            backgroundColor: color.border,
          }}
        />
      )}
    </View>
  );
}
