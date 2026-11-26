import type { LucideIcon } from 'lucide-react-native';
import { View } from 'react-native';

import { perDay } from '@/features/customer/domain/carRental/carStatus';
import type { CarOffer } from '@/features/customer/schemas/carRental';
import { RatingLine } from '@/features/customer/ui/RatingLine';
import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { formatNaira } from '@/shared/lib/formatNaira';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { PressableScale, Text } from '@/shared/ui';

type Props = {
  offer: CarOffer;
  /** The quote's headline (QuoteTerms.nameOf). */
  name: string;
  /** Days the price covers (car rental), for the per-day line; null when not priced by day. */
  span: { days: number; words: string } | null;
  /** "car", "vehicle". */
  vehicleWord: string;
  showSeats: boolean;
  /** For a quote with no photo. */
  icon: LucideIcon;
  /** Replaces the default facts line (security: service · team). */
  facts?: string;
  /** No photo: no block at all. */
  photoOptional?: boolean;
  onPress: (o: CarOffer) => void;
};

const PHOTO = 200;

/** The company's own photo of the car, or null: a stock photo never poses as their car. */
export function quotePhoto(o: CarOffer): string | null {
  return o.vehicle?.imageUrls[0] ?? o.imageUrls[0] ?? null;
}

/** "Ikeja Car Hire · 5 seats · Verified car"; logistics: "Swift Dispatch · Verified vehicle". */
export function quoteFacts(o: CarOffer, vehicleWord = 'car', showSeats = true): string {
  return [
    o.vendor?.name ?? null,
    !showSeats || o.vehicle?.seats == null ? null : `${String(o.vehicle.seats)} seats`,
    o.vehicle?.verified === true ? `Verified ${vehicleWord}` : null,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
}

// Design 3A (Turo): one big card per quote, led by the car; the trip total, then per day.
export function QuoteCard({
  offer: o,
  name,
  span,
  vehicleWord,
  showSeats,
  icon,
  facts,
  photoOptional = false,
  onPress,
}: Props) {
  const photo = quotePhoto(o);
  const daily = span === null ? null : perDay(o.amount, span.days);
  const total = `${formatNaira(o.amount)} total`;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        name,
        facts ?? quoteFacts(o, vehicleWord, showSeats),
        total,
        daily === null ? null : `${formatNaira(daily)} a day`,
      ]
        .filter(Boolean)
        .join(', ')}
      onPress={() => {
        onPress(o);
      }}
      testID={`quote-${o.id}`}
    >
      <View
        style={{
          borderRadius: radius.r4,
          borderCurve: 'continuous',
          overflow: 'hidden',
          borderWidth: borderWidth.hairline,
          borderColor: color.border,
          backgroundColor: color.surface,
        }}
      >
        {photo === null && photoOptional ? null : (
          <CarPhoto source={photo} height={PHOTO} corner={0} recyclingKey={o.id} icon={icon} />
        )}
        <View style={{ padding: space.s5, gap: space.s3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 }}>
            <Text variant="title" style={{ flex: 1 }} numberOfLines={2}>
              {name}
            </Text>
            <RatingLine
              avg={o.vendor?.rating ?? null}
              count={o.vendor?.reviewCount ?? null}
              compact
            />
          </View>
          <Text variant="bodySm" tone="textSecondary" numberOfLines={2}>
            {facts ?? quoteFacts(o, vehicleWord, showSeats)}
          </Text>
          <View style={{ gap: space.s1 }}>
            <Text variant="bodyStrong" tabular>
              {total}
            </Text>
            {span === null ? null : (
              <Text variant="bodySm" tone="textSecondary" tabular>
                {daily === null ? span.words : `${formatNaira(daily)} a day · ${span.words}`}
              </Text>
            )}
          </View>
        </View>
      </View>
    </PressableScale>
  );
}
