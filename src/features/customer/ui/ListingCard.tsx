import { Image } from 'expo-image';
import {
  BedDouble,
  Building2,
  CalendarDays,
  Star,
  Ticket,
  type LucideIcon,
} from 'lucide-react-native';
import { memo } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import type { ListingKind } from '@/features/customer/domain/discover';
import type { ListingCardModel } from '@/features/customer/domain/listingCard';
import { HeartButton } from '@/features/customer/ui/HeartButton';
import { PriceTag, priceSpoken } from '@/features/customer/ui/PriceTag';
import { RatingLine, ratingSpoken } from '@/features/customer/ui/RatingLine';
import { cardSize, color, iconSize, iconStroke, radius, space, typeVariants } from '@/shared/theme';
import { Icon, PressableScale, Text } from '@/shared/ui';

export type CardVariant = 'feature' | 'rail' | 'grid';

/** A rail card's width; its 4:3 image follows. */
export const RAIL_CARD_WIDTH = cardSize.railWidth;

const KIND_WORD: Record<ListingKind, string> = {
  hotel: 'Hotel',
  apartment: 'Apartment',
  event: 'Event',
};
// No photo: a wash block with the kind's icon, never a stock image (DESIGN_SYSTEM §6).
const KIND_ICON: Record<ListingKind, LucideIcon> = {
  hotel: BedDouble,
  apartment: Building2,
  event: Ticket,
};

type Props = {
  listing: ListingCardModel;
  variant: CardVariant;
  saved: boolean;
  /** Hearts wait until the saved list has loaded. */
  savedReady: boolean;
  onOpen: (l: ListingCardModel) => void;
  onToggleSaved: (l: ListingCardModel) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

function Photo({ l }: { l: ListingCardModel }) {
  const frame: ImageStyle = { width: '100%', aspectRatio: 4 / 3 };
  // The kind's icon sits under the photo: it shows while there is none, and when one fails to load
  // (never a blank box). No stock image (DESIGN_SYSTEM §6).
  return (
    <View
      style={[
        frame,
        {
          borderRadius: radius.r4,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: color.wash,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Icon as={KIND_ICON[l.kind]} size="md" tone="textMuted" />
      {l.image !== null ? (
        <Image
          source={{ uri: l.image }}
          // Originals only: no thumbnail endpoint yet (D14).
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          cachePolicy="memory-disk"
          recyclingKey={`${l.kind}:${l.id}`}
          transition={0}
          accessible={false}
          testID={`listing-image-${l.id}`}
        />
      ) : null}
    </View>
  );
}

// Cards side by side line up line for line (owner, 2026-11-15; Airbnb, TikTok, Posh, StubHub): a
// one-line title (owner's pick over two lines, which left a gap under short names; the full name is
// on the listing page), then the area and rating (events: date, then venue), each slot keeping its
// height when the listing has nothing for it, and the price pinned to the foot.
// 8 between text lines, 12 from photo to title (owner, 2026-11-15: "too tight").
const LINE_GAP = space.s3;
const META_HEIGHT = typeVariants.bodySm.lineHeight + space.s2;
const TITLE_LINES = 1;
const TITLE_HEIGHT = typeVariants.bodyStrong.lineHeight * TITLE_LINES;
const DETAILS_HEIGHT =
  TITLE_HEIGHT +
  typeVariants.bodySm.lineHeight +
  META_HEIGHT +
  typeVariants.bodyStrong.lineHeight +
  LINE_GAP * 3;

function Details({ l }: { l: ListingCardModel }) {
  // A saved snapshot (no price, rating or date, D9): title and place only, like an Airbnb
  // wishlist, with no empty slots reserved under them.
  if (l.price === null && l.rating === null && l.when === null)
    return (
      <View style={{ gap: LINE_GAP }}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {l.title ?? KIND_WORD[l.kind]}
        </Text>
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
          {l.area ?? KIND_WORD[l.kind]}
        </Text>
      </View>
    );
  const area =
    l.area !== null ? (
      <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
        {l.area}
      </Text>
    ) : (
      <View style={{ height: typeVariants.bodySm.lineHeight }} />
    );
  const meta = (
    <View style={{ justifyContent: 'center', minHeight: META_HEIGHT }}>
      {l.kind === 'event' ? (
        l.when !== null ? (
          // Final UX review U5: a tag on a wash, no border, so it never reads as a chip/button.
          <View
            testID="event-when"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: space.s2,
              paddingHorizontal: space.s3,
              paddingVertical: space.s1,
              borderRadius: radius.r2,
              backgroundColor: color.wash,
            }}
          >
            <Icon as={CalendarDays} size="xs" tone="textSecondary" />
            <Text variant="labelSm" numberOfLines={1}>
              {l.when}
            </Text>
          </View>
        ) : null
      ) : l.rating !== null ? (
        <RatingLine avg={l.rating.avg} count={l.rating.count} compact />
      ) : (
        // Airbnb marks a stay with no reviews instead of leaving a gap; "No reviews yet" is the
        // honest version (the stay may not be new).
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1} testID="no-reviews">
          No reviews yet
        </Text>
      )}
    </View>
  );
  return (
    <View
      style={{
        gap: LINE_GAP,
        flexShrink: 1,
        flexGrow: 1,
        minHeight: DETAILS_HEIGHT,
      }}
    >
      <Text variant="bodyStrong" numberOfLines={TITLE_LINES} style={{ minHeight: TITLE_HEIGHT }}>
        {l.title ?? KIND_WORD[l.kind]}
      </Text>
      {/* Events: the date before the venue (StubHub, Posh), since every event has a date and
          not every one a venue, so a missing venue leaves room at the foot, not mid-card. */}
      {l.kind === 'event' ? (
        <>
          {meta}
          {area}
        </>
      ) : (
        <>
          {area}
          {meta}
        </>
      )}
      <View style={{ marginTop: 'auto' }}>
        <PriceTag price={l.price} />
      </View>
    </View>
  );
}

/**
 * Airbnb's search results (owner's pick, 2026-11-15, Mobbin "Homes in Menlo Park"): the name with
 * "★ 4.6 (47)" at its right, the place (events: the day, then the venue), and the price with the
 * amount underlined. Nothing reserved for what a listing lacks: each card sizes to its own lines.
 */
function FeatureDetails({ l }: { l: ListingCardModel }) {
  const lines = (l.kind === 'event' ? [l.when, l.area] : [l.area]).filter(
    (x): x is string => x !== null,
  );
  return (
    <View style={{ gap: space.s1 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
        <Text variant="bodyStrong" numberOfLines={1} style={{ flex: 1 }}>
          {l.title ?? KIND_WORD[l.kind]}
        </Text>
        {l.rating !== null ? (
          <View
            testID="feature-rating"
            style={{ flexDirection: 'row', alignItems: 'center', gap: space.s2 }}
          >
            <Star
              size={iconSize.xs}
              strokeWidth={iconStroke}
              color={color.textPrimary}
              fill={color.textPrimary}
            />
            <Text variant="bodySm" tabular>
              {`${l.rating.avg.toFixed(1)} (${String(l.rating.count)})`}
            </Text>
          </View>
        ) : null}
      </View>
      {lines.map((line) => (
        <Text key={line} variant="bodySm" tone="textSecondary" numberOfLines={1}>
          {line}
        </Text>
      ))}
      <View style={{ paddingTop: space.s2 }}>
        <PriceTag price={l.price} underline />
      </View>
    </View>
  );
}

// Spec §3: image, title, area, rating (or an event's date), price, heart. The heart sits
// beside the card's pressable, not inside it, so screen readers reach both. Press feedback is the
// kit's scale (off under Reduce Motion).
function ListingCardView({
  listing: l,
  variant,
  saved,
  savedReady,
  onOpen,
  onToggleSaved,
  style,
  testID,
}: Props) {
  const title = l.title ?? KIND_WORD[l.kind];
  const spoken = [
    title,
    l.area,
    l.when,
    l.rating === null ? null : ratingSpoken(l.rating.avg, l.rating.count),
    priceSpoken(l.price),
  ]
    .filter((s): s is string => s !== null)
    .join(', ');
  const heart = (
    <HeartButton
      title={title}
      saved={saved}
      disabled={!savedReady}
      onToggle={() => {
        onToggleSaved(l);
      }}
      testID={`heart-${l.id}`}
    />
  );
  const open = () => {
    onOpen(l);
  };
  return (
    <View
      testID={testID}
      style={[
        variant === 'rail' ? { width: RAIL_CARD_WIDTH } : variant === 'grid' ? { flex: 1 } : null,
        style,
      ]}
    >
      <PressableScale accessibilityRole="button" accessibilityLabel={spoken} onPress={open}>
        <View style={{ gap: space.s4 }}>
          <Photo l={l} />
          {variant === 'feature' ? <FeatureDetails l={l} /> : <Details l={l} />}
        </View>
      </PressableScale>
      <View style={{ position: 'absolute', top: space.s3, right: space.s3 }}>{heart}</View>
    </View>
  );
}

// Memoised (low-end list rules): rails and results re-render on refresh and sheet state, and a
// card only needs to redraw when its model, saved state or callbacks change.
export const ListingCard = memo(ListingCardView);
