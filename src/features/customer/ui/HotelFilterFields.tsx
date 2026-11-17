import {
  AirVent,
  BadgeCheck,
  Car,
  ConciergeBell,
  Coffee,
  ShowerHead,
  Dumbbell,
  Plug,
  Tv,
  Waves,
  Wifi,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import {
  HOTEL_AMENITIES,
  type Filters,
  type HotelAmenity,
} from '@/features/customer/domain/discover';
import { RATING_OF, RATINGS, ratingKey, type Rating } from '@/features/customer/ui/filterOptions';
import { FilterSection } from '@/features/customer/ui/FilterSection';
import { ToggleTile } from '@/features/customer/ui/ToggleTile';
import { borderWidth, color, radius, space } from '@/shared/theme';
import { FilterChips, Icon, Stepper, Text, useDensity } from '@/shared/ui';

const AMENITY: Record<HotelAmenity, { label: string; icon: LucideIcon }> = {
  wifi: { label: 'Wi-Fi', icon: Wifi },
  'air-vent': { label: 'Air conditioning', icon: AirVent },
  waves: { label: 'Pool', icon: Waves },
  car: { label: 'Parking', icon: Car },
  dumbbell: { label: 'Gym', icon: Dumbbell },
  utensils: { label: 'Room service', icon: ConciergeBell },
  droplet: { label: 'Hot water', icon: ShowerHead },
  tv: { label: 'TV', icon: Tv },
};
const GUESTS_MAX = 10;

type Props = { draft: Filters; set: (patch: Partial<Filters>) => void };

// Airbnb's amenity pills: an icon and a word, on and off. On: the selected wash with the darker
// violet outline (colour plus the heavier border, never hue alone), as ToggleTile.
function AmenityPill({ a, on, onChange }: { a: HotelAmenity; on: boolean; onChange: () => void }) {
  const d = useDensity();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={AMENITY[a].label}
      accessibilityState={{ checked: on }}
      onPress={onChange}
      testID={`amenity-${a}`}
      style={({ pressed }) => ({
        minHeight: d.minTarget,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.s3,
        paddingHorizontal: space.s5,
        borderRadius: radius.rFull,
        borderWidth: on ? borderWidth.thick : borderWidth.hairline,
        borderColor: on ? color.actionPressed : color.borderStrong,
        backgroundColor: on ? color.selectedWash : pressed ? color.wash : color.surface,
      })}
    >
      <Icon as={AMENITY[a].icon} size="sm" />
      <Text variant="label" maxScale={1.3}>
        {AMENITY[a].label}
      </Text>
    </Pressable>
  );
}

/**
 * The hotel half of the filters (owner's pick A, 2026-11-15, after Airbnb): what most guests decide
 * on first as big tiles (power, breakfast, certification), then guests, rating and amenities. Only
 * filters the route really applies (BACKEND_STATUS §9): "Has a generator" matches 24-hour and
 * partial backup, so it never promises 24 hours.
 */
export function HotelFilterFields({ draft, set }: Props) {
  const amenities = draft.amenities ?? [];
  const toggle = (a: HotelAmenity) => {
    const next = amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a];
    set({ amenities: next.length > 0 ? next : undefined });
  };
  return (
    <>
      <FilterSection title="Guests" subtitle="Rooms that sleep this many">
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Text variant="body" testID="guests-label">
            {draft.guests === undefined || draft.guests <= 1
              ? 'Any number'
              : `${String(draft.guests)} or more`}
          </Text>
          <Stepper
            label="Guests"
            value={draft.guests ?? 1}
            min={1}
            max={GUESTS_MAX}
            onChange={(n) => {
              set({ guests: n > 1 ? n : undefined });
            }}
            testID="guests-stepper"
          />
        </View>
      </FilterSection>
      <FilterSection title="Guest rating">
        <FilterChips<Rating>
          label="Guest rating"
          value={ratingKey(draft.minRating)}
          options={RATINGS}
          onChange={(r) => {
            set({ minRating: RATING_OF[r] });
          }}
        />
      </FilterSection>
      <FilterSection title="Amenities" subtitle="Hotels with every one you pick">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
          {HOTEL_AMENITIES.map((a) => (
            <AmenityPill
              key={a}
              a={a}
              on={amenities.includes(a)}
              onChange={() => {
                toggle(a);
              }}
            />
          ))}
        </View>
      </FilterSection>
    </>
  );
}

/** "Most wanted" (Airbnb's "Recommended for you"): the three things most guests decide on. */
export function HotelMostWanted({ draft, set }: Props) {
  return (
    <FilterSection title="Most wanted">
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.s3 }}>
        <ToggleTile
          icon={Plug}
          label="Has a generator"
          checked={draft.generator24h === true}
          onChange={(b) => {
            set({ generator24h: b || undefined });
          }}
        />
        <ToggleTile
          icon={Coffee}
          label="Breakfast included"
          checked={draft.breakfastIncluded === true}
          onChange={(b) => {
            set({ breakfastIncluded: b || undefined });
          }}
        />
        <ToggleTile
          icon={BadgeCheck}
          label="NIHOTOUR certified"
          checked={draft.certified === true}
          onChange={(b) => {
            set({ certified: b || undefined });
          }}
        />
      </View>
    </FilterSection>
  );
}
