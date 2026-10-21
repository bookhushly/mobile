import { router } from 'expo-router';
import { View } from 'react-native';

import { PriceTag } from '@/features/customer/ui/PriceTag';
import { CHECKOUT_PAYMENTS_ENABLED, CHECKOUT_STAYS_ENABLED } from '@/shared/config/features';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Button, Text } from '@/shared/ui';

export type RoomTypeModel = {
  id: string;
  name: string;
  /** "Up to 2 guests · 1 king bed · 28 m²": what is known, else null. */
  facts: string | null;
  /** D5: the lowest of its rates and base price; null → the web has the price. */
  from: number | null;
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

// Mobbin §4 (Booking.com, Shopee): name, guests, beds, size, "From ₦… / night". Room status can't
// be read, so the label says "From" (D5). With stays checkout on (P2), Select opens checkout for
// this room type; Select checks availability once dates are chosen (P11).
export function RoomTypeCard({ room, hotelId }: { room: RoomTypeModel; hotelId: string }) {
  const selectable = CHECKOUT_STAYS_ENABLED && CHECKOUT_PAYMENTS_ENABLED;
  return (
    <View
      testID={`room-${room.id}`}
      style={{
        gap: space.s2,
        padding: space.s5,
        borderRadius: radius.r3,
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        backgroundColor: color.surface,
      }}
    >
      <Text variant="bodyStrong">{room.name}</Text>
      {room.facts !== null ? (
        <Text variant="bodySm" tone="textSecondary">
          {room.facts}
        </Text>
      ) : null}
      <PriceTag
        price={
          room.from === null
            ? { text: 'Price on bookhushly.com' }
            : { amount: room.from, unit: 'night', prefix: 'From' }
        }
      />
      {selectable ? (
        <Button
          label="Select"
          accessibilityLabel={`Select ${room.name}`}
          variant="secondary"
          onPress={() => {
            router.push({
              pathname: '/checkout/[kind]/[listingId]',
              params: { kind: 'hotel', listingId: hotelId, roomType: room.id },
            });
          }}
          testID={`room-select-${room.id}`}
        />
      ) : null}
    </View>
  );
}
