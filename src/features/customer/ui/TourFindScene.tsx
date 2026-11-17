import { Ticket } from 'lucide-react-native';
import { View } from 'react-native';

import { TourChip } from '@/features/customer/ui/TourChip';
import { TourFloat, type TourMotion } from '@/features/customer/ui/TourFloat';
import { TourStayCard } from '@/features/customer/ui/TourStayCard';
import { space } from '@/shared/theme';

const hotel = require('../../../../assets/images/auth/hotel.webp') as number;
const apartment = require('../../../../assets/images/auth/apartment.webp') as number;

// Find your place: a hotel and an apartment card as Explore shows them, overlapping, with an
// event tag pinned to the apartment photo's corner (never over a price). Illustrative content (no real listing, so never a name
// a guest could look for).
export function TourFindScene(m: TourMotion) {
  return (
    <View>
      {/* Browsing: the hotel rises and its tilt settles, the apartment slides in on top from the
          right, then the event tag lands on its corner. */}
      <TourFloat
        {...m}
        depth={0.14}
        tilt={-3}
        enter={{ y: space.s9, turn: -6, scale: 0.96, delay: 0 }}
        style={{ width: '70%' }}
      >
        <TourStayCard
          photo={hotel}
          name="Lagoon-view room"
          place="Hotel · Ikoyi, Lagos"
          nightly={85000}
        />
      </TourFloat>
      <TourFloat
        {...m}
        depth={0.3}
        tilt={3}
        enter={{ x: space.s11, turn: 8, delay: 140 }}
        // Overlaps the hotel card's lower corner, so the two read as a pile.
        style={{ width: '58%', alignSelf: 'flex-end', marginTop: -space.s11 }}
      >
        <TourStayCard
          photo={apartment}
          name="Two-bed apartment"
          place="Lekki, Lagos"
          nightly={120000}
        />
        <TourFloat
          {...m}
          enter={{ scale: 0.5, pop: true, delay: 400 }}
          style={{ position: 'absolute', right: space.s3, top: -space.s5 }}
        >
          <TourChip icon={Ticket} label="Poetry night · Sat" />
        </TourFloat>
      </TourFloat>
    </View>
  );
}
