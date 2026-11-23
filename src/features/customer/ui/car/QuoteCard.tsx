import { View } from 'react-native';

import { perDay } from '@/features/customer/domain/carRental/carStatus';
import type { VehicleType } from '@/features/customer/domain/carRental/carRequest';
import type { CarOffer } from '@/features/customer/schemas/carRental';
import { RatingLine } from '@/features/customer/ui/RatingLine';
import { CarPhoto } from '@/features/customer/ui/car/CarPhoto';
import { carName, daysWords } from '@/features/customer/ui/car/carWords';
import { formatNaira } from '@/shared/lib/formatNaira';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { PressableScale, Text } from '@/shared/ui';

type Props = {
  offer: CarOffer;
  /** What was asked for: the fallback photo when the company sent none. */
  askedType: VehicleType | null;
  days: number;
  onPress: (o: CarOffer) => void;
};

const PHOTO = 200;

/** The company's own photo of the car, or null: a stock photo never poses as their car. */
export function quotePhoto(o: CarOffer): string | null {
  return o.vehicle?.imageUrls[0] ?? o.imageUrls[0] ?? null;
}

/** "Ikeja Car Hire · 5 seats · Verified car". */
export function quoteFacts(o: CarOffer): string {
  return [
    o.vendor?.name ?? null,
    o.vehicle?.seats == null ? null : `${String(o.vehicle.seats)} seats`,
    o.vehicle?.verified === true ? 'Verified car' : null,
  ]
    .filter((s): s is string => s !== null)
    .join(' · ');
}

// Design 3A (Turo): one big card per quote, led by the car; the trip total, then per day.
export function QuoteCard({ offer: o, askedType, days, onPress }: Props) {
  const photo = quotePhoto(o);
  const name = carName(o.vehicle, askedType);
  const daily = perDay(o.amount, days);
  const total = `${formatNaira(o.amount)} total`;
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={[
        name,
        quoteFacts(o),
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
        <CarPhoto source={photo} height={PHOTO} corner={0} recyclingKey={o.id} />
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
            {quoteFacts(o)}
          </Text>
          <View style={{ gap: space.s1 }}>
            <Text variant="bodyStrong" tabular>
              {total}
            </Text>
            <Text variant="bodySm" tone="textSecondary" tabular>
              {daily === null
                ? daysWords(days)
                : `${formatNaira(daily)} a day · ${daysWords(days)}`}
            </Text>
          </View>
        </View>
      </View>
    </PressableScale>
  );
}
