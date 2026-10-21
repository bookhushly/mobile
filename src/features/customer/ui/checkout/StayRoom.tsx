import { View } from 'react-native';

import { bedsLine } from '@/features/customer/domain/listingDetail';
import type { RoomRate, RoomType } from '@/features/customer/schemas/listings';
import { space } from '@/shared/theme';
import { Card, formatNaira, ListRow, Stack, Text } from '@/shared/ui';

type Props = {
  roomType: RoomType;
  /** This room type's rates. */
  rates: RoomRate[];
  rateId: string | null;
  /** The chosen rate's beds, as words. */
  beds: string | null;
  onRate: (rateId: string) => void;
};

const rateTitle = (r: RoomRate) => r.label ?? bedsLine(r.beds) ?? 'Room rate';

// The room being booked, and (P25) a Bed option picker when it has more than one rate.
export function StayRoom({ roomType, rates, rateId, beds, onRate }: Props) {
  const sleeps = roomType.max_occupancy;
  return (
    <Stack gap="s4">
      <Card>
        <View style={{ gap: space.s1 }} testID="room-summary">
          <Text variant="headline">{roomType.name ?? 'Room'}</Text>
          {beds !== null ? (
            <Text variant="bodySm" tone="textSecondary">
              {beds}
            </Text>
          ) : null}
          {sleeps !== null ? (
            <Text variant="bodySm" tone="textSecondary">
              {`Sleeps up to ${String(sleeps)}`}
            </Text>
          ) : null}
        </View>
      </Card>
      {rates.length > 1 ? (
        <Stack gap="s2" testID="bed-options">
          <Text variant="headline">Bed option</Text>
          {rates.map((r) => (
            <ListRow
              key={r.id}
              title={rateTitle(r)}
              subtitle={
                r.price_per_night === null ? undefined : `${formatNaira(r.price_per_night)} / night`
              }
              checked={r.id === rateId}
              onPress={() => {
                onRate(r.id);
              }}
              testID={`rate-${r.id}`}
            />
          ))}
        </Stack>
      ) : null}
    </Stack>
  );
}
