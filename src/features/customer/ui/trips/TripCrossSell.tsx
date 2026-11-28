import { ChevronRight, X } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { crossSell, openTrip, type CrossSellItem } from '@/features/customer/domain/trips/trips';
import { useTrips } from '@/features/customer/hooks/useTrips';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { Icon, IconButton, ListRow, Text } from '@/shared/ui';

type Props = {
  userId: string;
  justBooked: 'hotel' | 'apartment' | 'event';
  onBook: (item: CrossSellItem) => void;
  /** The open trip to add to, or null to plan one. */
  onTrip: (tripId: string | null) => void;
};

/**
 * The web's TripCrossSell, after a booking: what travellers usually also need, and the trip to
 * add it to (or plan one). Quiet rows, so "View booking" stays the one action.
 */
export function TripCrossSell({ userId, justBooked, onBook, onTrip }: Props) {
  const [dismissed, setDismissed] = useState(false);
  const trips = useTrips(userId);
  if (dismissed) return null;
  const trip = trips.data === undefined ? null : openTrip(trips.data);
  const chevron = <Icon as={ChevronRight} size="sm" tone="textSecondary" />;
  return (
    <View
      style={{
        borderWidth: borderWidth.hairline,
        borderColor: color.border,
        borderRadius: radius.r4,
        paddingHorizontal: space.s5,
        paddingTop: space.s4,
        paddingBottom: space.s2,
      }}
      testID="trip-cross-sell"
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space.s3 }}>
        <View style={{ flex: 1, gap: space.s1 }}>
          <Text variant="bodyStrong" accessibilityRole="header">
            Complete your trip
          </Text>
          <Text variant="bodySm" tone="textSecondary">
            Most travellers also need these. Book them here and keep everything in one place.
          </Text>
        </View>
        <IconButton
          icon={X}
          accessibilityLabel="Hide suggestions"
          onPress={() => {
            setDismissed(true);
          }}
        />
      </View>
      {crossSell(justBooked).map((item) => (
        <ListRow
          key={item.type}
          title={item.label}
          trailing={chevron}
          onPress={() => {
            onBook(item);
          }}
          testID={`cross-sell-${item.type}`}
        />
      ))}
      <ListRow
        title={trip === null ? 'Plan a full trip' : `Add to “${trip.name}”`}
        trailing={chevron}
        onPress={() => {
          onTrip(trip === null ? null : trip.id);
        }}
        testID="cross-sell-trip"
      />
    </View>
  );
}
