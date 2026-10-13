import { Image } from 'expo-image';
import { BedDouble, Building2, CalendarDays, Ticket, type LucideIcon } from 'lucide-react-native';
import { Pressable, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';

import type { ListingKind } from '@/features/customer/domain/discover';
import type { ListingCardModel } from '@/features/customer/domain/listingCard';
import { HeartButton } from '@/features/customer/ui/HeartButton';
import { PriceTag, priceSpoken } from '@/features/customer/ui/PriceTag';
import { RatingLine, ratingSpoken } from '@/features/customer/ui/RatingLine';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, Text } from '@/shared/ui';

export type CardVariant = 'row' | 'rail' | 'grid';

/** A rail card's width; its 4:3 image follows. */
export const RAIL_CARD_WIDTH = 240;
const ROW_IMAGE = 96;

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

function Photo({ l, square }: { l: ListingCardModel; square: boolean }) {
  const frame: ImageStyle = square
    ? { width: ROW_IMAGE, height: ROW_IMAGE }
    : { width: '100%', aspectRatio: 4 / 3 };
  if (l.image === null)
    return (
      <View
        style={[
          frame,
          {
            borderRadius: radius.r3,
            backgroundColor: color.wash,
            alignItems: 'center',
            justifyContent: 'center',
          },
        ]}
      >
        <Icon as={KIND_ICON[l.kind]} size="md" tone="textMuted" />
      </View>
    );
  return (
    <Image
      source={{ uri: l.image }}
      // A wash while it loads (originals only: no thumbnail endpoint yet, D14).
      style={[frame, { borderRadius: radius.r3, backgroundColor: color.wash }]}
      contentFit="cover"
      cachePolicy="memory-disk"
      recyclingKey={`${l.kind}:${l.id}`}
      transition={0}
      accessible={false}
      testID={`listing-image-${l.id}`}
    />
  );
}

function Details({ l }: { l: ListingCardModel }) {
  return (
    <View style={{ gap: space.s2, flexShrink: 1 }}>
      <Text variant="bodyStrong" numberOfLines={2}>
        {l.title ?? KIND_WORD[l.kind]}
      </Text>
      {l.area !== null ? (
        <Text variant="bodySm" tone="textSecondary" numberOfLines={1}>
          {l.area}
        </Text>
      ) : null}
      {l.kind === 'event' ? (
        l.when !== null ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              alignSelf: 'flex-start',
              gap: space.s2,
              paddingHorizontal: space.s3,
              paddingVertical: space.s1,
              borderRadius: radius.r2,
              borderWidth: borderWidth.hairline,
              borderColor: color.border,
              backgroundColor: color.surface,
            }}
          >
            <Icon as={CalendarDays} size="xs" tone="textSecondary" />
            <Text variant="labelSm" numberOfLines={1}>
              {l.when}
            </Text>
          </View>
        ) : null
      ) : l.rating !== null ? (
        <RatingLine avg={l.rating.avg} count={l.rating.count} />
      ) : null}
      <PriceTag price={l.price} />
    </View>
  );
}

// Spec §3: image, title (2 lines), area, rating (or an event's date), price, heart. The heart sits
// beside the card's pressable, not inside it, so screen readers reach both.
export function ListingCard({
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
  if (variant === 'row')
    return (
      <View
        testID={testID}
        style={[
          {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: space.s3,
            paddingVertical: space.s4,
            borderBottomWidth: borderWidth.hairline,
            borderBottomColor: color.border,
          },
          style,
        ]}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={spoken}
          onPress={open}
          style={{ flex: 1, flexDirection: 'row', gap: space.s4 }}
        >
          <Photo l={l} square />
          <Details l={l} />
        </Pressable>
        {heart}
      </View>
    );
  return (
    <View
      testID={testID}
      style={[variant === 'rail' ? { width: RAIL_CARD_WIDTH } : { flex: 1 }, style]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={spoken}
        onPress={open}
        style={{ gap: space.s3 }}
      >
        <Photo l={l} square={false} />
        <Details l={l} />
      </Pressable>
      <View style={{ position: 'absolute', top: space.s3, right: space.s3 }}>{heart}</View>
    </View>
  );
}
