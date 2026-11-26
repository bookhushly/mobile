import { View } from 'react-native';

import type { Vehicle } from '@/features/vendor/domain/requests';
import { ServicePhoto } from '@/features/vendor/ui/ServicePhoto';
import { radius, space, vendorSize } from '@/shared/theme';
import { ListRow, Text } from '@/shared/ui';

type Props = {
  vehicles: Vehicle[];
  chosen: string | null;
  /** Send was tried without one: say so. */
  missing: boolean;
  onChoose: (id: string) => void;
};

/** Which vehicle the quote is for: photo rows, one choice (the fleet is managed on the web). */
export function VehiclePicker({ vehicles, chosen, missing, onChoose }: Props) {
  return (
    <View style={{ gap: space.s3 }}>
      <Text variant="label">Which vehicle?</Text>
      {missing ? (
        <Text variant="caption" tone="textPrimary" accessibilityLiveRegion="polite">
          Choose the vehicle you’ll send
        </Text>
      ) : null}
      <View accessibilityRole="radiogroup">
        {vehicles.map((v) => (
          <ListRow
            key={v.id}
            title={v.name}
            subtitle={v.detail}
            checked={chosen === v.id}
            leading={
              <View
                style={{
                  width: vendorSize.rowPhoto,
                  borderRadius: radius.r3,
                  overflow: 'hidden',
                }}
              >
                <ServicePhoto photo={v.photo} height={vendorSize.rowPhoto} />
              </View>
            }
            onPress={() => {
              onChoose(v.id);
            }}
            testID={`vendor-vehicle-${v.id}`}
          />
        ))}
      </View>
      <Text variant="caption" tone="textSecondary">
        Add vehicles and drivers on bookhushly.com.
      </Text>
    </View>
  );
}
