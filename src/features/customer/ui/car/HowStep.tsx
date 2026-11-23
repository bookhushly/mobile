import { View } from 'react-native';

import {
  MAX_PASSENGERS,
  type CarDraft,
  type TripType,
} from '@/features/customer/domain/carRental/carRequest';
import { TRIP_PHOTO } from '@/features/customer/ui/car/carPhotos';
import { TRIP } from '@/features/customer/ui/car/carWords';
import { PhotoChoice } from '@/features/customer/ui/car/PhotoChoice';
import { space } from '@/shared/theme';
import { Stack, Stepper, useDensity } from '@/shared/ui';

type Props = { draft: CarDraft; onChange: (p: Partial<CarDraft>) => void };

const ORDER: readonly TripType[] = ['chauffeur', 'self_drive'];

// Step 3: two photo cards, then passengers.
export function HowStep({ draft, onChange }: Props) {
  const d = useDensity();
  return (
    <Stack gap="s7">
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: d.targetGap }}>
        {ORDER.map((t) => (
          <PhotoChoice
            key={t}
            title={TRIP[t].label}
            blurb={TRIP[t].blurb}
            image={TRIP_PHOTO[t]}
            checked={draft.tripType === t}
            onPress={() => {
              onChange({ tripType: t });
            }}
            testID={`car-trip-${t}`}
          />
        ))}
      </View>
      <View style={{ gap: space.s2 }}>
        <Stepper
          label="Passengers, including you"
          value={draft.passengers}
          min={1}
          max={MAX_PASSENGERS}
          onChange={(n) => {
            onChange({ passengers: n });
          }}
          testID="car-passengers"
        />
      </View>
    </Stack>
  );
}
