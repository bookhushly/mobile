import { View } from 'react-native';

import {
  LOGISTICS_VEHICLES,
  type LogisticsDraft,
  type LogisticsVehicle,
} from '@/features/customer/domain/logistics/logisticsRequest';
import { CharCounter } from '@/features/customer/ui/CharCounter';
import { PhotoRow } from '@/features/customer/ui/logistics/PhotoRow';
import { LOGISTICS_VEHICLE_PHOTO } from '@/features/customer/ui/logistics/logisticsPhotos';
import { LOGISTICS_VEHICLE } from '@/features/customer/ui/logistics/logisticsWords';
import { INSTRUCTIONS_MAX } from '@/features/customer/domain/logistics/logisticsRequest';
import { space } from '@/shared/theme';
import { Input, Stack, useDensity } from '@/shared/ui';

type Props = { draft: LogisticsDraft; onChange: (p: Partial<LogisticsDraft>) => void };

// Step 6: vehicles as photo rows with what each carries (like car types), or the company picks.
// Special instructions sit under them, optional.
export function VehicleStep({ draft, onChange }: Props) {
  const d = useDensity();
  const pick = (v: LogisticsVehicle | null) => {
    onChange({ vehicleType: v });
  };
  return (
    <Stack gap="s7">
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="What should carry it?"
        style={{ gap: d.targetGap }}
      >
        {LOGISTICS_VEHICLES.map((v) => (
          <PhotoRow
            key={v}
            title={LOGISTICS_VEHICLE[v].label}
            line={LOGISTICS_VEHICLE[v].line}
            photo={LOGISTICS_VEHICLE_PHOTO[v]}
            checked={draft.vehicleType === v}
            tick
            onPress={() => {
              pick(v);
            }}
            testID={`logistics-vehicle-${v}`}
          />
        ))}
        <PhotoRow
          title="Let the company choose"
          line="They quote what fits"
          photo={null}
          checked={draft.vehicleType === null}
          tick
          onPress={() => {
            pick(null);
          }}
          testID="logistics-vehicle-any"
        />
      </View>
      <View style={{ gap: space.s2 }}>
        <Input
          label="Anything they should know? (optional)"
          value={draft.notes}
          onChangeText={(t) => {
            onChange({ notes: t });
          }}
          placeholder="Gate code, call on arrival, stairs…"
          multiline
          maxLength={INSTRUCTIONS_MAX}
          testID="logistics-notes"
        />
        <CharCounter length={draft.notes.length} max={INSTRUCTIONS_MAX} />
      </View>
    </Stack>
  );
}
