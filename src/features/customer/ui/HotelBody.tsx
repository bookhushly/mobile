import { View } from 'react-native';

import type { HotelListing } from '@/features/customer/api/listingDetailDb';
import { roomTypeFrom } from '@/features/customer/domain/discover';
import { defaultBeds, hotelFacts } from '@/features/customer/domain/listingDetail';
import { clockLabel } from '@/features/customer/domain/myBookings';
import { plainText } from '@/features/customer/domain/plainText';
import { AmenityLines, AmenityList } from '@/features/customer/ui/AmenityList';
import { DetailRows } from '@/features/customer/ui/DetailRows';
import { DetailSection } from '@/features/customer/ui/DetailSection';
import { ReadMoreText } from '@/features/customer/ui/ReadMoreText';
import { RoomTypeCard, roomFacts } from '@/features/customer/ui/RoomTypeCard';
import { space } from '@/shared/theme';

type Props = {
  listing: HotelListing;
  onShowAmenities: () => void;
  /** Where the Rooms section starts in the scroll content (the footer's "Choose a room"). */
  onRoomsAt?: (y: number) => void;
  /** With stays checkout on (P2): a room type's Select. Absent → the rooms are display only. */
  onSelectRoom?: (roomTypeId: string) => void;
};

const at = (word: string, t: string | null) => {
  const c = clockLabel(t);
  return c === null ? '' : `${word} ${c}`;
};

// Spec §3 hotel: facts (breakfast, power, transfer), amenities, room types, times, policies.
export function HotelBody({ listing, onShowAmenities, onRoomsAt, onSelectRoom }: Props) {
  const { hotel: h, roomTypes, rates } = listing;
  const facts = hotelFacts(h);
  const policies = [plainText(h.policies), plainText(h.checkout_policy)]
    .filter((s): s is string => s !== null)
    .join('\n\n');
  return (
    <>
      {facts.length > 0 ? (
        <DetailSection label="Good to know" testID="hotel-facts">
          <AmenityLines items={facts} />
        </DetailSection>
      ) : null}
      {h.amenities.length > 0 ? (
        <DetailSection label="Amenities">
          <AmenityList amenities={h.amenities} onShowAll={onShowAmenities} testID="amenities" />
        </DetailSection>
      ) : null}
      {roomTypes.length > 0 ? (
        <View
          onLayout={(e) => {
            onRoomsAt?.(e.nativeEvent.layout.y);
          }}
        >
          <DetailSection label="Rooms" testID="rooms">
            <View style={{ gap: space.s3 }}>
              {roomTypes.map((t) => (
                <RoomTypeCard
                  key={t.id}
                  onSelect={
                    onSelectRoom === undefined
                      ? undefined
                      : () => {
                          onSelectRoom(t.id);
                        }
                  }
                  room={{
                    id: t.id,
                    name: t.name?.trim() || 'Room',
                    facts: roomFacts(t.max_occupancy, defaultBeds(t.id, rates), t.size_sqm),
                    from: roomTypeFrom(t, rates),
                  }}
                />
              ))}
            </View>
          </DetailSection>
        </View>
      ) : null}
      <DetailRows
        rows={[
          { label: 'Check-in', value: at('From', h.check_in_time) },
          { label: 'Check-out', value: at('By', h.check_out_time) },
        ]}
      />
      {policies !== '' ? (
        <DetailSection label="Policies">
          <ReadMoreText text={policies} />
        </DetailSection>
      ) : null}
    </>
  );
}
