import { Clock } from 'lucide-react-native';
import { View } from 'react-native';

import type { HotelListing } from '@/features/customer/api/listingDetailDb';
import { roomTypeFrom } from '@/features/customer/domain/discover';
import { defaultBeds, hotelFacts } from '@/features/customer/domain/listingDetail';
import { clockLabel } from '@/features/customer/domain/myBookings';
import { plainText } from '@/features/customer/domain/plainText';
import { amenityIcon } from '@/features/customer/ui/amenityIcon';
import { AmenityList } from '@/features/customer/ui/AmenityList';
import { DetailSection } from '@/features/customer/ui/DetailSection';
import { IconRow } from '@/features/customer/ui/IconRow';
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
  const prices = roomTypes
    .map((t) => roomTypeFrom(t, rates))
    .filter((p): p is number => p !== null);
  const lowest = prices.length > 0 ? Math.min(...prices) : null;
  const checkIn = at('from', h.check_in_time);
  const checkOut = at('by', h.check_out_time);
  const policies = [plainText(h.policies), plainText(h.checkout_policy)]
    .filter((s): s is string => s !== null)
    .join('\n\n');
  return (
    <>
      {facts.length > 0 ? (
        <DetailSection label="Highlights" testID="hotel-facts">
          {facts.map((f) => (
            <IconRow key={f} icon={amenityIcon(f)} title={f} />
          ))}
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
              {roomTypes.map((t) => {
                const from = roomTypeFrom(t, rates);
                return (
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
                      from,
                      image: t.image_urls?.[0] ?? null,
                      lowest: from !== null && from === lowest && roomTypes.length > 1,
                    }}
                  />
                );
              })}
            </View>
          </DetailSection>
        </View>
      ) : null}
      {checkIn !== '' || checkOut !== '' ? (
        <IconRow
          icon={Clock}
          title={checkIn !== '' ? `Check-in ${checkIn}` : `Check-out ${checkOut}`}
          subtitle={checkIn !== '' && checkOut !== '' ? `Check-out ${checkOut}` : null}
          testID="hotel-times"
        />
      ) : null}
      {policies !== '' ? (
        <DetailSection label="Policies">
          <ReadMoreText text={policies} />
        </DetailSection>
      ) : null}
    </>
  );
}
