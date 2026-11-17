import { Image } from 'expo-image';
import { View } from 'react-native';

import { amenityIcon } from '@/features/customer/ui/amenityIcon';
import { PriceTag } from '@/features/customer/ui/PriceTag';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Button, Icon, Text } from '@/shared/ui';

export type RoomTypeModel = {
  id: string;
  name: string;
  /** "Up to 2 guests · 1 king bed · 28 m²": what is known, else null. */
  facts: string | null;
  /** D5: the lowest of its rates and base price; null → the web has the price. */
  from: number | null;
  /** The room's first photo, if it has one. */
  image?: string | null;
  /** The cheapest room type on the page gets Expedia's "Lowest price" band. */
  lowest?: boolean;
};

const plural = (n: number, one: string, many: string) => `${String(n)} ${n === 1 ? one : many}`;

/** The facts line for a room type from what is known. */
export function roomFacts(
  maxGuests: number | null,
  beds: string | null,
  sizeSqm: number | null,
): string | null {
  const parts = [
    maxGuests !== null && maxGuests > 0
      ? `Up to ${plural(Math.floor(maxGuests), 'guest', 'guests')}`
      : null,
    beds,
    sizeSqm !== null && sizeSqm > 0 ? `${String(Math.round(sizeSqm))} m²` : null,
  ].filter((s): s is string => s !== null);
  return parts.length > 0 ? parts.join(' · ') : null;
}

// Mobbin §4 (Booking.com, Shopee), restyled after Expedia's room cards (2026-11-14): an optional
// "Lowest price" band, the room's photo, its name, each fact on its own icon line, then the price
// and Select. Room status can't be read, so the label says "From" (D5). With stays checkout on
// (P2) the listing passes `onSelect`; availability is checked in checkout (P11).
export function RoomTypeCard({ room, onSelect }: { room: RoomTypeModel; onSelect?: () => void }) {
  const facts = room.facts === null ? [] : room.facts.split(' · ');
  return (
    <View
      testID={`room-${room.id}`}
      style={{
        borderRadius: radius.r4,
        borderCurve: 'continuous',
        overflow: 'hidden',
        borderWidth: borderWidth.hairline,
        borderColor: room.lowest === true ? color.actionFill : color.border,
        backgroundColor: color.surface,
      }}
    >
      {room.lowest === true ? (
        <View
          testID={`room-lowest-${room.id}`}
          style={{
            paddingHorizontal: space.s5,
            paddingVertical: space.s2,
            backgroundColor: color.actionFill,
          }}
        >
          <Text variant="labelSm" tone="onAction">
            Lowest price
          </Text>
        </View>
      ) : null}
      {room.image !== undefined && room.image !== null ? (
        <Image
          source={{ uri: room.image }}
          style={{ width: '100%', aspectRatio: 16 / 9, backgroundColor: color.wash }}
          contentFit="cover"
          accessible={false}
        />
      ) : null}
      <View style={{ gap: space.s3, padding: space.s5 }}>
        <Text variant="bodyStrong">{room.name}</Text>
        {facts.length > 0 ? (
          <View style={{ gap: space.s2 }} accessible accessibilityLabel={room.facts ?? undefined}>
            {facts.map((f) => (
              <View key={f} style={{ flexDirection: 'row', alignItems: 'center', gap: space.s3 }}>
                <Icon as={amenityIcon(f)} size="xs" tone="textSecondary" />
                <Text variant="bodySm" tone="textSecondary">
                  {f}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
        <PriceTag
          price={
            room.from === null
              ? { text: 'Price on bookhushly.com' }
              : { amount: room.from, unit: 'night', prefix: 'From' }
          }
        />
        {onSelect !== undefined ? (
          <Button
            label="Select"
            accessibilityLabel={`Select ${room.name}`}
            variant="secondary"
            onPress={onSelect}
            testID={`room-select-${room.id}`}
          />
        ) : null}
      </View>
    </View>
  );
}
